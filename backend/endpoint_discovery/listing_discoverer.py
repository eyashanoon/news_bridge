"""
listing_discoverer.py
─────────────────────
Discovers all Article-Listing endpoints within a target domain using BFS
(max depth 2), classifying each page with the page_classifier model and
building a hierarchical URL tree.

Usage (library)
───────────────
    from listing_discoverer import ListingDiscoverer
    from page_classifier import Predictor

    predictor  = Predictor()          # load once
    discoverer = ListingDiscoverer("https://www.bbc.com", predictor=predictor)
    result     = discoverer.discover()

    # result["tree"]  — nested dict representing the URL tree
    # result["cache"] — list of all investigated URLs with their metadata

Usage (CLI)
───────────
    python listing_discoverer.py https://www.bbc.com
    python listing_discoverer.py https://www.bbc.com --max-depth 2 --out results.json
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
import time
from collections import Counter, defaultdict, deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Callable, Optional
from urllib.parse import urlencode, urljoin, parse_qs, urlparse, urlunparse

import requests
from bs4 import BeautifulSoup


# ── Constants ──────────────────────────────────────────────────────────────────

REQUEST_TIMEOUT    = 15           # seconds per HTTP request
REQUEST_DELAY      = 0.5          # polite crawl delay between requests (seconds)
MAX_CONTENT_BYTES  = 5_000_000    # skip pages larger than 5 MB
MAX_LINKS_PER_PAGE = 500          # cap extracted links per page

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; ListingDiscoverer/1.0; "
        "+https://github.com/listingdiscovery)"
    ),
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# URL-keyword sets used to compute url_features
_DATE_PATTERN  = re.compile(r"/\d{4}/\d{1,2}(/\d{1,2})?/")
_ARTICLE_KW    = {"article", "articles", "story", "stories", "post", "posts", "news", "blog"}
_VIDEO_KW      = {"video", "videos", "watch", "clip", "clips"}
_AUDIO_KW      = {"audio", "podcast", "podcasts", "radio", "listen"}
_LISTING_KW    = {
    "category", "categories", "tag", "tags", "topic", "topics",
    "section", "sections", "archive", "archives", "index", "listing",
    "listings", "feed", "search", "results", "latest", "recent",
    "collection", "collections",
}


# ── URL Utilities ──────────────────────────────────────────────────────────────

def normalize_url(url: str, base: str = "") -> str:
    """
    Return a normalized absolute URL:
      - Resolve relative URLs against *base*
      - Strip fragments (#...)
      - Lower-case the host
      - Remove trailing slash from path (except root '/')
      - Stable-sort query string parameters
    Returns an empty string for non-http(s) URLs.
    """
    if base:
        url = urljoin(base, url)
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return ""
    path = parsed.path
    if path != "/" and path.endswith("/"):
        path = path.rstrip("/")
    query = urlencode(
        sorted(parse_qs(parsed.query, keep_blank_values=True).items())
    )
    return urlunparse((
        parsed.scheme,
        parsed.netloc.lower(),
        path,
        parsed.params,
        query,
        "",          # strip fragment
    ))


def same_domain(url: str, root: str) -> bool:
    """True if *url* belongs to the same hostname or a sub-domain of *root*."""
    host = urlparse(url).netloc.lower()
    root_host = urlparse(root).netloc.lower()
    return host == root_host or host.endswith("." + root_host)


def _url_features(url: str) -> dict:
    """Compute the 9-field url_features dict expected by the classifier."""
    parsed   = urlparse(url)
    segments = [s for s in parsed.path.split("/") if s]
    seg_set  = {s.lower() for s in segments}
    return {
        "url_depth":           len(segments),
        "url_has_date":        int(bool(_DATE_PATTERN.search(parsed.path))),
        "url_has_article_kw":  int(bool(seg_set & _ARTICLE_KW)),
        "url_has_video_kw":    int(bool(seg_set & _VIDEO_KW)),
        "url_has_audio_kw":    int(bool(seg_set & _AUDIO_KW)),
        "url_has_listing_kw":  int(bool(seg_set & _LISTING_KW)),
        "url_query_count":     len(parse_qs(parsed.query)),
        "url_length":          len(url),
        "is_root_path":        int(parsed.path in ("", "/")),
    }


# ── URL Pattern Grouper ────────────────────────────────────────────────────────

# Thresholds — no domain-specific knowledge, purely statistical signals
_ENTROPY_THRESHOLD  = 3.4   # bits/char; hash-like IDs consistently exceed this
_MIN_ID_LENGTH      = 7     # short segments are rarely machine-generated IDs
_MIN_FREQ_RATIO     = 0.25  # segment seen in < 25% of sibling URLs → treat as slug
_MIN_PEERS_FOR_FREQ = 6     # need at least this many peers before frequency check fires
                            # (prevents all-unique language prefixes from becoming {slug})
_PLACEHOLDER_TOKENS = {"{slug}", "{id}", "{num}", "{date}"}
_DATE_SEG_RE        = re.compile(
    r"^\d{4}[-/]\d{1,2}([-/]\d{1,2})?$"  # 2024-01 or 2024-01-15
    r"|^\d{8}$"                            # 20240115
)
_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
    re.IGNORECASE,
)
_HEX_RE = re.compile(r"^[0-9a-f]{10,}$", re.IGNORECASE)  # pure lowercase/uppercase hex, ≥10 chars


def _shannon_entropy(s: str) -> float:
    """Shannon entropy of the characters in *s* (bits per character)."""
    if len(s) < 2:
        return 0.0
    counts = Counter(s)
    n = len(s)
    return -sum((c / n) * math.log2(c / n) for c in counts.values())


def _segment_token(segment: str, position_peers: list[str]) -> str:
    """
    Decide whether a path segment is structural (return it as-is) or
    variable (return a placeholder token).  Decision is based on three
    purely statistical signals — no hardcoded domain patterns:

      1. Numeric / date-like → {num} / {date}
      2. High Shannon entropy + minimum length → {id}
      3. Mixed alphanumeric + minimum length → {id}
      4. Rare at this position across sibling URLs → {slug}
    """
    seg = segment.lower()

    if seg.isdigit():
        return "{num}"

    if _DATE_SEG_RE.match(seg):
        return "{date}"

    if _UUID_RE.match(seg):
        return "{id}"

    if _HEX_RE.match(seg):
        return "{id}"

    entropy = _shannon_entropy(seg)
    if entropy >= _ENTROPY_THRESHOLD and len(seg) >= _MIN_ID_LENGTH:
        return "{id}"

    has_alpha = any(c.isalpha() for c in seg)
    has_digit = any(c.isdigit() for c in seg)
    if has_alpha and has_digit and len(seg) >= _MIN_ID_LENGTH:
        return "{id}"

    # Frequency check: only when there are enough peers to be statistically meaningful.
    # Without this guard, sections like 'bengali', 'arabic', 'sport' (each unique at
    # depth-1) would all become {slug}, producing the useless pattern /{slug}.
    if position_peers and len(position_peers) >= _MIN_PEERS_FOR_FREQ:
        freq_ratio = position_peers.count(segment) / len(position_peers)
        if freq_ratio < _MIN_FREQ_RATIO:
            return "{slug}"

    return segment  # structural — keep as-is


def _pick_representative(group_urls: list[str]) -> str:
    """
    Choose the URL from *group_urls* most likely to represent the group’s page
    type accurately when probed.

    Heuristic: prefer shorter paths (fewer segments → more likely to be a
    section root than a deep article); break ties by fewest variable-looking
    terminal segments, then by total URL string length.
    """
    def _score(u: str) -> tuple:
        parsed = urlparse(u)
        segs   = [s for s in parsed.path.split("/") if s]
        var_count = sum(
            1 for s in segs
            if s.isdigit()
            or _UUID_RE.match(s)
            or _HEX_RE.match(s)
            or (len(s) >= 8 and any(c.isdigit() for c in s) and any(c.isalpha() for c in s))
            or _shannon_entropy(s) >= _ENTROPY_THRESHOLD
        )
        return (len(segs), var_count, len(u))
    return min(group_urls, key=_score)


class URLPatternGrouper:
    """
    Groups a list of same-domain URLs by their inferred structural pattern.

    The pattern is derived by abstracting variable path segments (IDs, hashes,
    dates, unique slugs) into placeholder tokens using purely statistical
    signals — no hardcoded site-specific rules.

    Example
    ───────
        /bengali/articles/c2ej89rx9yzo  →  /bengali/articles/{id}
        /bengali/articles/c707p4kgjk0o  →  /bengali/articles/{id}  (same group)
        /bengali/live/cp8pgxjg5g7t      →  /bengali/live/{id}      (different group)

    Usage
    ─────
        grouper = URLPatternGrouper()
        groups  = grouper.group(urls)
        # { pattern_string: [url, url, ...], ... }
    """

    def extract_pattern(self, url: str, peers: list[str]) -> str:
        """Derive a structural template from *url* using *peers* for
        per-position frequency analysis."""
        parsed   = urlparse(url)
        segments = [s for s in parsed.path.split("/") if s]
        n_segs   = len(segments)

        # Build per-position peer lists (only same-depth peers are comparable)
        same_depth_segs = [
            [s for s in urlparse(p).path.split("/") if s]
            for p in peers
            if len([s for s in urlparse(p).path.split("/") if s]) == n_segs
        ]
        position_peers = [
            [segs[i] for segs in same_depth_segs if i < len(segs)]
            for i in range(n_segs)
        ]

        tokens = [
            _segment_token(seg, position_peers[i])
            for i, seg in enumerate(segments)
        ]

        path_pattern = "/" + "/".join(tokens) if tokens else "/"
        return f"{parsed.scheme}://{parsed.netloc}{path_pattern}"

    def group(self, urls: list[str]) -> dict[str, list[str]]:
        """Return {pattern: [url, ...]} grouping."""
        # Separate by depth first so frequency analysis is always like-for-like
        by_depth: dict[int, list[str]] = defaultdict(list)
        for url in urls:
            depth = len([s for s in urlparse(url).path.split("/") if s])
            by_depth[depth].append(url)

        groups: dict[str, list[str]] = {}
        for depth_urls in by_depth.values():
            for url in depth_urls:
                pattern = self.extract_pattern(url, depth_urls)
                groups.setdefault(pattern, []).append(url)
        return groups


# ── Page Feature Extraction ────────────────────────────────────────────────────

def extract_page_features(soup: BeautifulSoup, url: str) -> dict:
    """
    Extract all feature dicts required by Predictor.predict_raw() from
    a parsed BeautifulSoup document.

    Returns a dict with keys:
        title, text, meta_tags, headings, dom_stats, url_features,
        structural_features, num_links, text_length, image_count
    """
    # ── DOM stats (6 fields) ─────────────────────────────────────────────────
    dom_stats = {
        "total_tags": len(soup.find_all()),
        "p_count":    len(soup.find_all("p")),
        "div_count":  len(soup.find_all("div")),
        "list_items": len(soup.find_all("li")),
        "tables":     len(soup.find_all("table")),
        "forms":      len(soup.find_all("form")),
    }

    # ── Structural features (19 numeric + schema/og handled by features.py) ──
    all_a_tags  = soup.find_all("a", href=True)
    nav_tags    = soup.find_all("nav")
    nav_link_n  = sum(len(n.find_all("a", href=True)) for n in nav_tags)
    li_w_links  = sum(1 for li in soup.find_all("li") if li.find("a", href=True))

    # Breadcrumbs
    breadcrumbs = soup.find_all(lambda t: (
        (t.get("class") and any("breadcrumb" in c.lower() for c in t.get("class", [])))
        or (t.get("aria-label") and "breadcrumb" in t.get("aria-label", "").lower())
    ))

    # Author presence
    has_author = int(bool(
        soup.find(attrs={"rel": "author"})
        or soup.find(attrs={"class": lambda c: c and any("author" in x.lower() for x in c)})
        or soup.find(attrs={"itemprop": "author"})
    ))

    # Comment section presence
    has_comments = int(bool(
        soup.find(id=lambda i: i and "comment" in i.lower())
        or soup.find(attrs={"class": lambda c: c and any("comment" in x.lower() for x in c)})
    ))

    # Pagination presence
    pagination_present = int(bool(
        soup.find(attrs={"class": lambda c: c and any(
            kw in " ".join(c).lower() for kw in ("pagination", "pager", "page-nav")
        )})
        or soup.find("a", rel="next")
        or soup.find("a", rel="prev")
    ))

    # Ad slots
    ad_slot_count = len(soup.find_all(lambda t: t.get("class") and any(
        kw in x.lower()
        for x in t.get("class", [])
        for kw in ("ad-slot", "advertisement", "banner-ad", "advert")
    )))

    # Average link text length
    link_texts       = [a.get_text(strip=True) for a in all_a_tags if a.get_text(strip=True)]
    avg_link_text_len = (
        sum(len(t) for t in link_texts) / len(link_texts) if link_texts else 0.0
    )

    # Nav link ratio
    total_links    = len(all_a_tags)
    nav_link_ratio = nav_link_n / total_links if total_links else 0.0

    # Body text
    body      = soup.find("body")
    body_text = body.get_text(" ", strip=True) if body else ""
    word_count = len(body_text.split())

    # Schema.org type from JSON-LD
    schema_type = ""
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            if isinstance(data, dict):
                schema_type = data.get("@type", "")
            elif isinstance(data, list) and data:
                schema_type = data[0].get("@type", "")
            if schema_type:
                break
        except (json.JSONDecodeError, AttributeError):
            pass

    # og:type from Open Graph meta tag
    og_tag  = soup.find("meta", property="og:type")
    og_type = og_tag["content"].strip().lower() if og_tag and og_tag.get("content") else ""

    structural_features = {
        "article_tag_count":     len(soup.find_all("article")),
        "video_tag_count":       len(soup.find_all("video")),
        "audio_tag_count":       len(soup.find_all("audio")),
        "nav_count":             len(nav_tags),
        "time_tag_count":        len(soup.find_all("time")),
        "figure_count":          len(soup.find_all("figure")),
        "blockquote_count":      len(soup.find_all("blockquote")),
        "h1_count":              len(soup.find_all("h1")),
        "h2_count":              len(soup.find_all("h2")),
        "h3_count":              len(soup.find_all("h3")),
        "list_items_with_links": li_w_links,
        "pagination_present":    pagination_present,
        "has_author":            has_author,
        "has_comments":          has_comments,
        "breadcrumb_count":      len(breadcrumbs),
        "avg_link_text_len":     round(avg_link_text_len, 2),
        "nav_link_ratio":        round(nav_link_ratio, 4),
        "ad_slot_count":         ad_slot_count,
        "word_count":            word_count,
        "schema_type":           schema_type,
        "og_type":               og_type,
    }

    # ── Meta tags ─────────────────────────────────────────────────────────────
    meta_tags: dict[str, str] = {}
    for tag in soup.find_all("meta"):
        name    = tag.get("name") or tag.get("property") or ""
        content = tag.get("content") or ""
        if name and content:
            meta_tags[name] = content

    # ── Headings ──────────────────────────────────────────────────────────────
    headings: list[str] = []
    for level in ("h1", "h2", "h3"):
        for tag in soup.find_all(level):
            txt = tag.get_text(" ", strip=True)
            if txt:
                headings.append(f"{level.upper()}: {txt}")

    # ── Title ─────────────────────────────────────────────────────────────────
    title_tag = soup.find("title")
    title     = title_tag.get_text(strip=True) if title_tag else ""
    if not title:
        h1    = soup.find("h1")
        title = h1.get_text(strip=True) if h1 else ""

    return {
        "title":               title,
        "text":                body_text[:1000],   # classifier uses a snippet
        "meta_tags":           meta_tags,
        "headings":            headings[:30],       # cap to avoid token overflow
        "dom_stats":           dom_stats,
        "url_features":        _url_features(url),
        "structural_features": structural_features,
        "num_links":           total_links,
        "text_length":         len(body_text),
        "image_count":         len(soup.find_all("img")),
    }


# ── Cache & Tree Data Structures ───────────────────────────────────────────────

@dataclass
class CacheEntry:
    """One record per discovered URL, acting as the single source of truth."""
    url:                   str
    domain_valid:          bool
    classification:        Optional[str]   = None   # "content_article" | "listing_article" | "other"
    confidence:            Optional[float] = None
    added_to_tree:         bool            = False
    rejection_reason:      Optional[str]   = None
    first_discovered_from: Optional[str]   = None
    processed:             bool            = False
    fetch_error:           Optional[str]   = None
    timestamp:             str             = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def to_dict(self) -> dict:
        return {
            "url":                   self.url,
            "domain_valid":          self.domain_valid,
            "classification":        self.classification,
            "confidence":            self.confidence,
            "added_to_tree":         self.added_to_tree,
            "rejection_reason":      self.rejection_reason,
            "first_discovered_from": self.first_discovered_from,
            "processed":             self.processed,
            "fetch_error":           self.fetch_error,
            "timestamp":             self.timestamp,
        }


@dataclass
class TreeNode:
    """A node in the discovered listing-URL tree."""
    url:      str
    depth:    int
    children: list = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "url":      self.url,
            "depth":    self.depth,
            "children": [c.to_dict() for c in self.children],
        }


# ── Main Discoverer Class ──────────────────────────────────────────────────────

class ListingDiscoverer:
    """
    Crawls a domain with BFS (max_depth levels) and builds a tree of all
    Article-Listing pages, using the page_classifier model for classification.

    Parameters
    ----------
    root_url      : Seed URL, e.g. "https://www.bbc.com"
    predictor     : A loaded page_classifier.Predictor instance.
                    One is created automatically if not provided.
    max_depth     : BFS depth limit (default 2).
    request_delay : Seconds to sleep between HTTP requests (polite crawling).
    """

    def __init__(
        self,
        root_url:      str,
        predictor      = None,
        max_depth:     int   = 2,
        request_delay: float = REQUEST_DELAY,
        log_callback:  Optional[Callable[[str], None]] = None,
    ) -> None:
        self.root_url      = normalize_url(root_url)
        if not self.root_url:
            raise ValueError(f"Invalid root URL: {root_url!r}")

        self.max_depth     = max_depth
        self.request_delay = request_delay
        self._log_callback = log_callback
        self._session      = self._make_session()
        self._cache:          dict[str, CacheEntry] = {}
        self._tree_urls:      set[str]              = set()   # fast dedup guard
        self._pattern_cache:  dict[str, str]        = {}      # pattern → label
        self._grouper         = URLPatternGrouper()

        if predictor is None:
            from page_classifier import Predictor
            self._log("Loading page classifier model ...")
            self._predictor = Predictor()
        else:
            self._predictor = predictor

    def _log(self, msg: str) -> None:
        # Windows consoles often use cp1252; strip non-ASCII to avoid encode errors.
        safe = msg.encode("ascii", errors="replace").decode("ascii")
        if self._log_callback:
            self._log_callback(safe)
        else:
            print(safe)

    # ── HTTP ──────────────────────────────────────────────────────────────────

    @staticmethod
    def _make_session() -> requests.Session:
        s = requests.Session()
        s.headers.update(_HEADERS)
        return s

    def _fetch(self, url: str) -> Optional[BeautifulSoup]:
        """
        Fetch *url* and parse it.  Returns None on any error (network,
        non-HTML content, or oversized response).  Stores fetch errors in the
        cache entry if one already exists.
        """
        try:
            resp = self._session.get(
                url,
                timeout=REQUEST_TIMEOUT,
                allow_redirects=True,
                stream=True,
            )
            resp.raise_for_status()

            if "html" not in resp.headers.get("Content-Type", ""):
                return None

            raw = b""
            for chunk in resp.iter_content(chunk_size=65_536):
                raw += chunk
                if len(raw) >= MAX_CONTENT_BYTES:
                    break

            return BeautifulSoup(raw, "lxml")

        except requests.RequestException as exc:
            entry = self._cache.get(url)
            if entry:
                entry.fetch_error = str(exc)
            return None

    # ── Link extraction ────────────────────────────────────────────────────────

    def _extract_links(self, soup: BeautifulSoup, page_url: str) -> list[str]:
        """
        Extract all <a href> links from *soup*, normalize them, and return
        only same-domain, deduplicated URLs (up to MAX_LINKS_PER_PAGE).
        """
        seen:   set[str]   = set()
        result: list[str]  = []
        for tag in soup.find_all("a", href=True):
            norm = normalize_url(tag["href"].strip(), base=page_url)
            if not norm or norm in seen:
                continue
            seen.add(norm)
            if same_domain(norm, self.root_url):
                result.append(norm)
            if len(result) >= MAX_LINKS_PER_PAGE:
                break
        return result

    # ── Classification ─────────────────────────────────────────────────────────

    def _classify(self, url: str, soup: BeautifulSoup) -> dict:
        """Run the page classifier on a fetched page and return its result dict."""
        feats = extract_page_features(soup, url)
        return self._predictor.predict_raw(
            title               = feats["title"],
            text                = feats["text"],
            url                 = url,
            meta_tags           = feats["meta_tags"],
            headings            = feats["headings"],
            dom_stats           = feats["dom_stats"],
            url_features        = feats["url_features"],
            structural_features = feats["structural_features"],
            num_links           = feats["num_links"],
            text_length         = feats["text_length"],
            image_count         = feats["image_count"],
        )

    # ── Cache helpers ──────────────────────────────────────────────────────────

    def _register(self, url: str, discovered_from: Optional[str]) -> CacheEntry:
        """Insert a new CacheEntry; raises KeyError if already present."""
        entry = CacheEntry(
            url=url,
            domain_valid=same_domain(url, self.root_url),
            first_discovered_from=discovered_from,
        )
        self._cache[url] = entry
        return entry

    # ── BFS ───────────────────────────────────────────────────────────────────

    def discover(self, max_depth: Optional[int] = None) -> dict:
        """
        Run the BFS discovery process.

        Returns
        -------
        {
            "root_url": str,
            "max_depth": int,
            "tree":  { url, depth, children: [...] },   # TreeNode.to_dict()
            "cache": [ { url, domain_valid, classification, ... }, ... ]
        }
        """
        if max_depth is not None:
            self.max_depth = max_depth

        # ── Initialise root ───────────────────────────────────────────────────
        root_entry               = self._register(self.root_url, discovered_from=None)
        root_entry.added_to_tree = True
        root_node                = TreeNode(url=self.root_url, depth=0)
        self._tree_urls.add(self.root_url)

        # BFS queue carries (TreeNode, current_depth)
        queue: deque[tuple[TreeNode, int]] = deque([(root_node, 0)])

        while queue:
            node, depth = queue.popleft()
            url         = node.url

            self._log(f"[BFS depth={depth}] Processing node: {url}")

            # ── Fetch the page ────────────────────────────────────────────────
            soup = self._fetch(url)
            time.sleep(self.request_delay)

            if soup is None:
                self._log("  [skip] Could not fetch page - skipping children.")
                continue

            # ── Classify current node (root counts as accepted; still record) ─
            node_entry = self._cache[url]
            if not node_entry.processed:
                result                   = self._classify(url, soup)
                node_entry.classification = result["label"]
                node_entry.confidence     = result["confidence"]
                node_entry.processed      = True
                if depth > 0 and result["label"] != "listing_article":
                    # Shouldn't normally reach here (children are pre-classified),
                    # but guards against edge cases.
                    node_entry.rejection_reason = f"classified as {result['label']}"
                    node_entry.added_to_tree    = False
                    continue

            # ── Stop expanding at max depth ───────────────────────────────────
            if depth >= self.max_depth:
                continue

            # ── Extract child links ───────────────────────────────────────────
            child_urls = self._extract_links(soup, url)
            self._log(f"  -> {len(child_urls)} same-domain links extracted")

            # ── Register ALL new child URLs in the cache up front ────────────
            # Every discovered URL is registered before any classification so
            # the cache is a complete record of all links encountered.
            new_urls = [u for u in child_urls if u not in self._cache]
            for u in new_urls:
                self._register(u, discovered_from=url)

            # ── Group by structural pattern ───────────────────────────────────
            groups = self._grouper.group(new_urls)
            self._log(f"  -> {len(new_urls)} new URLs in {len(groups)} pattern groups")

            # ── Per-group classification protocol ────────────────────────────
            #
            #  The pattern is used ONLY to decide whether to probe a group at
            #  all.  It is never used to infer tree membership without testing.
            #
            #  For each group:
            #   1. NEGATIVE CACHE HIT (pattern known non-listing):
            #      → Skip all members without fetching.
            #
            #   2. PROBE (pattern new, or known listing — skip re-probe):
            #      a. Fetch & classify the best representative.
            #      b. Representative → NOT listing_article:
            #         Store pattern as non-listing; skip all remaining members.
            #      c. Representative → listing_article:
            #         Add to tree; then INDIVIDUALLY fetch + classify every
            #         remaining member.  Only confirmed listing pages are added.
            #
            #  Invariant: no URL enters the tree without an individual model call.
            # ─────────────────────────────────────────────────────────────────
            for pattern, group_urls in groups.items():

                # 1. Negative pattern cache — skip without any fetches ─────────
                if pattern in self._pattern_cache:
                    cached_label = self._pattern_cache[pattern]
                    if cached_label not in ("listing_article", "fetch_failed"):
                        for child_url in group_urls:
                            e = self._cache[child_url]
                            e.classification   = cached_label
                            e.processed        = True
                            e.rejection_reason = (
                                f"pattern-cache: known {cached_label} pattern"
                            )
                        self._log(f"    [cached-skip] '{pattern}' -> {cached_label}"
                                  f"  ({len(group_urls)} skipped)")
                        continue

                # 2. Probe the group representative ───────────────────────────
                already_known_listing = (
                    self._pattern_cache.get(pattern) == "listing_article"
                )

                if not already_known_listing:
                    candidate  = _pick_representative(group_urls)
                    cand_entry = self._cache[candidate]
                    self._log(f"    [probe] {candidate}  (pattern: {pattern})")
                    cand_soup = self._fetch(candidate)
                    time.sleep(self.request_delay)

                    if cand_soup is None:
                        cand_entry.processed       = True
                        cand_entry.rejection_reason = (
                            "fetch failed (group representative)"
                        )
                        for child_url in group_urls:
                            if child_url == candidate:
                                continue
                            e = self._cache[child_url]
                            e.processed        = True
                            e.rejection_reason = (
                                "skipped: group representative fetch failed"
                            )
                        continue

                    result      = self._classify(candidate, cand_soup)
                    probe_label = result["label"]
                    cand_entry.classification = probe_label
                    cand_entry.confidence     = result["confidence"]
                    cand_entry.processed      = True
                    self._pattern_cache[pattern] = probe_label
                    self._log(f"    [pattern learned] '{pattern}' -> {probe_label}")

                    # 2b. Non-listing representative → skip entire group ───────
                    if probe_label != "listing_article":
                        cand_entry.rejection_reason = (
                            f"classified as {probe_label}"
                        )
                        for child_url in group_urls:
                            if child_url == candidate:
                                continue
                            e = self._cache[child_url]
                            e.classification   = probe_label
                            e.processed        = True
                            e.rejection_reason = (
                                f"group-skip: representative → {probe_label}"
                            )
                        self._log(f"    [group-skip]  {len(group_urls) - 1} members skipped")
                        continue

                    # 2c. Representative IS listing_article → add to tree ──────
                    if candidate not in self._tree_urls:
                        cand_node = TreeNode(url=candidate, depth=depth + 1)
                        node.children.append(cand_node)
                        self._tree_urls.add(candidate)
                        cand_entry.added_to_tree = True
                        self._log(f"    [ok] [representative] Added (depth={depth + 1}): {candidate}")
                        if depth + 1 < self.max_depth:
                            queue.append((cand_node, depth + 1))
                    else:
                        cand_entry.rejection_reason = "duplicate — already in tree"

                    remaining = [u for u in group_urls if u != candidate]
                else:
                    # Pattern already known listing — test all members directly
                    remaining = list(group_urls)
                    self._log(f"    [known-listing] '{pattern}' - testing"
                              f" {len(remaining)} members individually")

                # ── Individually classify every remaining group member ────────
                # This is the ONLY path that adds URLs to the tree.
                # Every member is fetched and classified; no pattern inference.
                for child_url in remaining:
                    entry = self._cache[child_url]

                    if child_url in self._tree_urls:
                        entry.rejection_reason = "duplicate — already in tree"
                        entry.processed        = True
                        continue

                    child_soup = self._fetch(child_url)
                    time.sleep(self.request_delay)

                    if child_soup is None:
                        entry.processed        = True
                        entry.rejection_reason = "fetch failed"
                        continue

                    result = self._classify(child_url, child_soup)
                    entry.classification = result["label"]
                    entry.confidence     = result["confidence"]
                    entry.processed      = True

                    if result["label"] != "listing_article":
                        entry.rejection_reason = f"classified as {result['label']}"
                        continue

                    if child_url in self._tree_urls:
                        entry.rejection_reason = "duplicate — already in tree"
                        continue

                    child_node = TreeNode(url=child_url, depth=depth + 1)
                    node.children.append(child_node)
                    self._tree_urls.add(child_url)
                    entry.added_to_tree = True
                    self._log(f"    [ok] Added (depth={depth + 1}): {child_url}")
                    if depth + 1 < self.max_depth:
                        queue.append((child_node, depth + 1))

        return {
            "root_url":      self.root_url,
            "max_depth":     self.max_depth,
            "tree":          root_node.to_dict(),
            "cache":         [e.to_dict() for e in self._cache.values()],
            "pattern_cache": self._pattern_cache,
        }


# ── Summary Helpers ────────────────────────────────────────────────────────────

def print_tree(node: dict, indent: int = 0) -> None:
    """Recursively print a tree dict to stdout."""
    prefix = "  " * indent + ("└─ " if indent else "")
    print(f"{prefix}[depth={node['depth']}] {node['url']}")
    for child in node.get("children", []):
        print_tree(child, indent + 1)


def summarise(result: dict) -> None:
    """Print a brief summary of the discovery run."""
    cache   = result["cache"]
    pcache  = result.get("pattern_cache", {})

    total          = len(cache)
    in_tree        = sum(1 for e in cache if e["added_to_tree"])
    indiv_tested   = sum(1 for e in cache if e["processed"] and e["classification"]
                         and not (e.get("rejection_reason") or "").startswith(
                             ("pattern-cache:", "group-skip:", "skipped:")))
    fetch_errors   = sum(1 for e in cache if e.get("fetch_error"))
    probes         = sum(1 for v in pcache.values() if v not in ("fetch_failed",))
    grp_skips      = sum(1 for e in cache
                         if (e.get("rejection_reason") or "").startswith("group-skip:"))
    cached_skips   = sum(1 for e in cache
                         if (e.get("rejection_reason") or "").startswith("pattern-cache:"))

    print("\n" + "=" * 60)
    print(f"Root URL           : {result['root_url']}")
    print(f"Max depth          : {result['max_depth']}")
    print(f"URLs found         : {total}")
    print(f"Individually tested: {indiv_tested}")
    print(f"Fetch errors       : {fetch_errors}")
    print(f"Tree nodes         : {in_tree}  (all individually confirmed)")
    print(f"Patterns learned   : {len(pcache)}")
    print(f"Pattern probes     : {probes}  (1 fetch per new pattern group)")
    print(f"Group skips        : {grp_skips}  (non-listing representative → rest skipped)")
    print(f"Cached skips       : {cached_skips}  (known non-listing pattern, no fetch)")
    print("=" * 60)
    if pcache:
        print("\nLearned URL patterns:")
        for pat, label in sorted(pcache.items()):
            print(f"  {label:20s}  {pat}")
    print("\nDiscovered tree:")
    print_tree(result["tree"])


# ── CLI ────────────────────────────────────────────────────────────────────────

def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Discover article-listing endpoints within a domain (BFS, depth ≤ 2)."
    )
    p.add_argument("root_url", help="Seed URL, e.g. https://www.bbc.com")
    p.add_argument(
        "--max-depth", type=int, default=2,
        help="BFS depth limit (default: 2)",
    )
    p.add_argument(
        "--delay", type=float, default=REQUEST_DELAY,
        help=f"Seconds between HTTP requests (default: {REQUEST_DELAY})",
    )
    p.add_argument(
        "--out", default="",
        help="Optional path to write the JSON result (e.g. results.json)",
    )
    return p.parse_args()


if __name__ == "__main__":
    args = _parse_args()

    from page_classifier import Predictor
    predictor  = Predictor()
    discoverer = ListingDiscoverer(
        root_url      = args.root_url,
        predictor     = predictor,
        max_depth     = args.max_depth,
        request_delay = args.delay,
    )

    result = discoverer.discover()
    summarise(result)

    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            json.dump(result, fh, indent=2, ensure_ascii=False)
        print(f"\nResults written to: {args.out}")

    # Write just the listing endpoint URLs to a separate file
    listing_urls = [
        entry["url"]
        for entry in result.get("cache", [])
        if entry.get("classification") == "listing_article" and entry.get("added_to_tree")
    ]
    endpoints_path = "endpoints.txt"
    with open(endpoints_path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(listing_urls))
    print(f"Listing endpoints written to: {endpoints_path} ({len(listing_urls)} URLs)")
