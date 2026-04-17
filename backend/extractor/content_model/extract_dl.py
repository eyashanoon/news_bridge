import argparse
import json
import re
from typing import Dict, List, Tuple
from urllib.parse import urljoin, urlparse

import requests
import torch
from bs4 import BeautifulSoup, Tag

try:
    from .features import get_tag, numeric_features
    from .model import BlockClassifier
except ImportError:
    from features import get_tag, numeric_features
    from model import BlockClassifier


BODY_TEXT_TAGS = {"p", "blockquote"}

IGNORED_TAGS = {
    "script",
    "style",
    "noscript",
    "template",
    "meta",
    "link",
    "head",
    "title",
    "svg",
}

STOP_SECTION_HINTS = {
    "related",
    "more from",
    "most read",
    "top stories",
    "recommended",
    "you may also",
    "latest",
    "read more",
    "more stories",
    "you might like",
    "recommended stories",
    "trending",
    "editor picks",
    "most popular",
    "إقرأ المزيد",
    "اقرأ المزيد",
    "ذات صلة",
    "المزيد",
    "اقرأ أيضا",
    "الأكثر قراءة",
    "قد يعجبك",
    "موصى",
    "موضوعات ذات صلة",
    "أخبار ذات صلة",
}

NOISE_HINTS = {
    "related",
    "recommend",
    "footer",
    "header",
    "nav",
    "menu",
    "promo",
    "taboola",
    "advert",
    "share",
    "social",
    "cookie",
    "copyright",
    "newsletter",
    "more-from",
    "trending",
    "most-read",
    "recommended",
    "promo-block",
    "you-may-also",
    "related-stories",
    "article-card",
    "story-card",
    "stories__item",
    "stories__title",
    "popular-press",
    "main-article--hidden",
    "card-headline",
    "media-overlay",
    "onetrust",
    "privacy-preference-center",
    "ذات-صلة",
    "الأكثر-قراءة",
}

UI_NOISE_TEXTS = {
    "advertisement",
    "save",
    "share",
    "copy link",
    "copylink",
    "click here to share on social media",
    "facebook twitter whatsapp copylink",
    "facebook",
    "twitter",
    "whatsapp",
    "print",
    "comments",
    "your privacy",
    "vendors list",
    "privacy policy",
    "cookie settings",
    "consent",
    "manage preferences",
    "privacy preference center",
    "when you visit any website",
    "in the form of cookies",
    "traffic sources",
    "performance of our site",
}

JS_SHELL_HINTS = {
    '<div id="root"></div>',
    "window['fp.prerender']",
    'window["fp.prerender"]',
    "__next",
    "id=\"app\"",
}

BLOCKED_PAGE_HINTS = {
    "access denied",
    "you don't have permission",
    "forbidden",
    "attention required",
    "verify you are human",
    "cf-challenge",
    "captcha",
    "bot detection",
    "temporarily unavailable",
}

NOISE_TOKEN_HINTS = {"nav", "menu", "header", "footer", "share", "social"}


def _class_id_text(node: Tag) -> str:
    classes = node.get("class") or []
    return f"{node.get('id', '')} {' '.join(classes)}".lower()


def _is_noise_node(node: Tag) -> bool:
    haystack = _class_id_text(node)
    if not haystack:
        return False

    tokens = set(re.findall(r"[a-z0-9_-]+", haystack))
    for hint in NOISE_HINTS:
        if hint in NOISE_TOKEN_HINTS:
            if hint in tokens:
                return True
            if any(token.startswith(f"{hint}-") or token.endswith(f"-{hint}") for token in tokens):
                return True
            continue
        if hint in haystack:
            return True
    return False


def _is_inside_noise(node: Tag) -> bool:
    cur = node
    while cur and isinstance(cur, Tag):
        # Do not treat page-level wrappers as noise ancestors; some sites put
        # utility classes like "header" on <body>, which would hide all content.
        tag_name = (cur.name or "").lower()
        if tag_name in {"body", "html"}:
            break
        if _is_noise_node(cur):
            return True
        cur = cur.parent
    return False


def _has_anchor_ancestor(node: Tag) -> bool:
    cur = node.parent
    while cur and isinstance(cur, Tag):
        if (cur.name or "").lower() == "a":
            return True
        cur = cur.parent
    return False


def _node_depth(node: Tag) -> int:
    depth = 0
    cur = node
    while cur and isinstance(cur, Tag):
        depth += 1
        cur = cur.parent
    return depth


def _sibling_index(node: Tag) -> int:
    if not node.parent or not isinstance(node.parent, Tag):
        return 1
    index = 1
    for sibling in node.previous_siblings:
        if isinstance(sibling, Tag):
            index += 1
    return index


def _sibling_count(node: Tag) -> int:
    if not node.parent or not isinstance(node.parent, Tag):
        return 1
    return sum(1 for child in node.parent.children if isinstance(child, Tag))


def _score_container(node: Tag) -> int:
    text_blocks = node.find_all(["p", "blockquote", "li"])
    words = 0
    for blk in text_blocks:
        words += len(blk.get_text(" ", strip=True).split())
    imgs = len(node.find_all("img"))
    links = len(node.find_all("a"))
    return words + (imgs * 5) - links


def _pick_content_root(soup: BeautifulSoup) -> Tag:
    h1 = soup.find("h1")
    if h1 and isinstance(h1, Tag):
        best_ancestor = None
        best_score = -1
        for anc in h1.parents:
            if not isinstance(anc, Tag):
                continue
            p_count = len(anc.find_all("p"))
            if p_count < 8:
                continue
            score = _score_container(anc)
            if score > best_score:
                best_score = score
                best_ancestor = anc
        if best_ancestor:
            return best_ancestor

    candidates: List[Tag] = []

    article_nodes = soup.find_all("article")
    if article_nodes:
        candidates.extend(article_nodes)

    main_node = soup.find("main")
    if main_node:
        candidates.append(main_node)

    role_main = soup.find(attrs={"role": "main"})
    if role_main:
        candidates.append(role_main)

    if not candidates:
        body = soup.body if soup.body else soup
        main_like = body.find_all(["div", "section"], recursive=True)
        for node in main_like:
            attrs = _class_id_text(node)
            if "article" in attrs or "story" in attrs or "content" in attrs:
                candidates.append(node)

    if not candidates:
        return soup.body if soup.body else soup

    best = max(candidates, key=_score_container)
    return best


def _has_stop_section_hint(text: str, attrs: Dict) -> bool:
    haystack = " ".join(
        [
            (text or "").lower(),
            str((attrs or {}).get("id") or "").lower(),
            " ".join((attrs or {}).get("classList") or []).lower(),
            " ".join((attrs or {}).get("parentClassList") or []).lower(),
        ]
    )
    return any(hint in haystack for hint in STOP_SECTION_HINTS)


def _is_ui_noise_text(text: str) -> bool:
    cleaned = " ".join((text or "").split()).strip().lower()
    if not cleaned:
        return True
    if cleaned in UI_NOISE_TEXTS:
        return True
    return any(hint in cleaned for hint in UI_NOISE_TEXTS)


def _is_card_like_block(block: Dict, label: str) -> bool:
    structure = block.get("structure") or {}
    attrs = block.get("attributes") or {}
    text = (block.get("text") or {}).get("clean") or ""
    text_norm = " ".join(text.split()).strip().lower()
    tag = (structure.get("tag") or "").lower()
    parent_tag = (structure.get("parentTag") or "").lower()

    class_haystack = " ".join(
        [
            str(attrs.get("id") or "").lower(),
            " ".join(attrs.get("classList") or []).lower(),
            " ".join(attrs.get("parentClassList") or []).lower(),
        ]
    )

    card_hint = any(
        hint in class_haystack
        for hint in {
            "card",
            "teaser",
            "related",
            "recommend",
            "most-read",
            "promo",
            "rail",
            "module",
            "story-item",
            "trending",
            "popular-press",
            "card-headline",
            "headline-text",
            "media-overlay",
        }
    )

    short_text = 0 < len(text_norm) <= 90
    title_like = (tag in {"h2", "h3", "h4", "h5", "a", "li"}) and short_text
    linked_context = parent_tag == "a" or tag == "a" or bool(attrs.get("hasAnchorAncestor"))

    if label == "IMAGE" and (card_hint or linked_context):
        return True
    if label == "TEXT" and title_like and (card_hint or linked_context):
        return True
    return False


def _is_credit_or_source_line(text: str, block: Dict) -> bool:
    cleaned = " ".join((text or "").split()).strip()
    if not cleaned:
        return True

    lower = cleaned.lower()
    text_len = len(cleaned)
    word_count = len(cleaned.split())
    tag = ((block.get("structure") or {}).get("tag") or "").lower()
    attrs = block.get("attributes") or {}
    link_density = float(((block.get("text") or {}).get("linkDensity") or 0.0))

    credit_hints = {
        "gettyimages.ru",
        "reuters",
        "ap photo",
        "afp",
        "epa",
        "rt",
        "source:",
        "المصدر",
        "رويترز",
        "وكالات",
        "صور",
    }

    if any(hint in lower for hint in credit_hints):
        return True

    if word_count <= 2 and text_len <= 20:
        if tag in {"p", "span", "div", "em", "strong"}:
            return True

    if link_density > 0.6 and text_len <= 80:
        return True

    class_haystack = " ".join(
        [
            str(attrs.get("id") or "").lower(),
            " ".join(attrs.get("classList") or []).lower(),
            " ".join(attrs.get("parentClassList") or []).lower(),
        ]
    )
    if any(hint in class_haystack for hint in {"credit", "caption", "photo-credit", "source", "byline"}):
        return True

    return False


def _title_candidate_score(block: Dict, title_prob: float) -> float:
    structure = block.get("structure") or {}
    attrs = block.get("attributes") or {}
    position = float((block.get("position") or {}).get("relativePosition") or 1.0)
    text = (block.get("text") or {}).get("clean") or ""
    cleaned = " ".join(text.split()).strip()
    if not cleaned:
        return float("-inf")

    lower = cleaned.lower()
    if _is_credit_or_source_line(cleaned, block) or _is_ui_noise_text(cleaned):
        return float("-inf")
    if _has_stop_section_hint(cleaned, attrs):
        return float("-inf")

    tag = (structure.get("tag") or "").lower()
    if tag not in {"h1", "h2", "h3"}:
        return float("-inf")

    word_count = len(cleaned.split())
    char_count = len(cleaned)
    if word_count < 2 or char_count < 8:
        return float("-inf")
    if char_count > 220:
        return float("-inf")
    if lower in {"home", "news", "article", "video", "photos"}:
        return float("-inf")

    tag_bonus = {"h1": 0.18, "h2": 0.08, "h3": 0.02}.get(tag, 0.0)
    length_bonus = 0.0
    if 20 <= char_count <= 120:
        length_bonus += 0.05
    if word_count >= 3:
        length_bonus += 0.03
    if tag == "h1" and char_count >= 18:
        length_bonus += 0.04
    if tag in {"h2", "h3"} and char_count < 20:
        length_bonus -= 0.08
    if tag in {"h2", "h3"}:
        length_bonus -= 0.04

    early_bonus = max(0.0, 0.18 - (position * 0.25))

    return title_prob + tag_bonus + length_bonus + early_bonus


def _title_overlap_score(text: str, url: str) -> float:
    cleaned = re.sub(r"\s+", " ", (text or "").lower()).strip()
    if not cleaned:
        return 0.0

    slug = urlparse(url).path
    slug = re.sub(r"[-_/]+", " ", slug.lower())
    slug_tokens = {token for token in re.findall(r"[a-z0-9]+", slug) if len(token) >= 4}
    title_tokens = {token for token in re.findall(r"[a-z0-9]+", cleaned) if len(token) >= 4}
    if not slug_tokens or not title_tokens:
        return 0.0

    overlap = len(slug_tokens & title_tokens)
    return overlap / max(1, min(len(slug_tokens), len(title_tokens)))


def _normalize_media_src(src: str, base_url: str) -> str:
    if not src:
        return ""
    src = src.strip()
    if src.startswith("data:"):
        return ""
    return urljoin(base_url, src)


def _first_src_from_srcset(srcset: str, base_url: str) -> str:
    if not srcset:
        return ""
    first_entry = srcset.split(",")[0].strip()
    if not first_entry:
        return ""
    candidate = first_entry.split()[0].strip()
    return _normalize_media_src(candidate, base_url)


def _norm_text_for_dedup(text: str) -> str:
    return " ".join((text or "").split()).strip().lower()


def _norm_media_for_dedup(src: str) -> str:
    """Normalize media URL for deduplication, removing query params and fragments."""
    raw = (src or "").strip().lower()
    if not raw:
        return ""
    parsed = urlparse(raw)
    if not parsed.scheme:
        return raw

    return f"{parsed.netloc}{parsed.path}"


IMAGE_VARIANT_SUFFIX_RE = re.compile(
    r"(?i)(?:[-_](?:\d{2,4}x\d{2,4}|\d{2,4}|thumb|thumbnail|small|sm|medium|med|large|lg|original|scaled|crop|cover|preview|banner|hero|retina|@2x|@1x))+$"
)


def _strip_image_variant_suffix(value: str) -> str:
    cleaned = (value or "").strip().lower()
    if not cleaned:
        return ""

    while True:
        updated = IMAGE_VARIANT_SUFFIX_RE.sub("", cleaned)
        if updated == cleaned:
            return cleaned
        cleaned = updated


def _canonical_media_path(src: str) -> str:
    raw = (src or "").strip().lower()
    if not raw:
        return ""

    parsed = urlparse(raw)
    if not parsed.scheme:
        return _strip_image_variant_suffix(raw)

    path_parts = [segment for segment in parsed.path.split("/") if segment]
    if path_parts:
        filename = path_parts[-1]
        if "." in filename:
            stem, ext = filename.rsplit(".", 1)
            filename = f"{_strip_image_variant_suffix(stem)}.{ext}"
        else:
            filename = _strip_image_variant_suffix(filename)
        path_parts[-1] = filename

    canonical_path = "/".join(path_parts)
    if canonical_path:
        return f"{parsed.netloc.lower()}/{canonical_path}"
    return parsed.netloc.lower()


def _get_image_base_name(src: str) -> str:
    """Extract base filename from image URL (for similarity detection)."""
    raw = (src or "").strip().lower()
    if not raw:
        return ""
    parsed = urlparse(raw)
    path = parsed.path
    # Get the last path component (filename)
    filename = path.split("/")[-1] if "/" in path else path
    # Remove common size indicators and extensions
    base = filename.rsplit(".", 1)[0] if "." in filename else filename
    # Remove common size/variant suffixes like _thumb, -small, _w800, etc
    for suffix in ["_thumb", "_small", "_large", "_medium", "-thumb", "-small", "-large", 
                   "-medium", "_400", "_800", "_1200", "@2x", "@1x"]:
        if base.endswith(suffix):
            base = base[:-len(suffix)]
    return base


def _media_similarity_key(src: str) -> str:
    """Create a similarity key for image deduplication (handles URL variants)."""
    normalized = _canonical_media_path(src)
    base_name = _get_image_base_name(src)
    return f"{normalized}||{base_name}"


def _is_valid_media_src(src: str) -> bool:
    if not src:
        return False
    lowered = src.lower()
    if "placeholder" in lowered:
        return False
    parsed = urlparse(src)
    if not parsed.scheme:
        return False
    return True


def _link_density(node: Tag, text: str) -> float:
    if not text:
        return 0.0
    link_text_len = 0
    for a in node.find_all("a"):
        link_text_len += len(a.get_text(" ", strip=True))
    return link_text_len / max(1, len(text))


def _fetch_html_requests(url: str) -> Tuple[str, int]:
    try:
        response = requests.get(url, timeout=30, headers={"User-Agent": "Mozilla/5.0"})
    except Exception:
        return "", 0

    status_code = response.status_code
    if status_code == 403:
        return response.text or "", status_code
    if status_code >= 400:
        return response.text or "", status_code

    content_encoding = (response.headers.get("content-encoding") or "").lower()
    if "br" in content_encoding:
        try:
            import brotli

            return brotli.decompress(response.content).decode("utf-8", errors="replace"), status_code
        except Exception:
            pass

    return response.text, status_code


def _text_block_count(soup: BeautifulSoup) -> int:
    count = 0
    for node in soup.find_all(["h1", "h2", "h3", "p", "article"]):
        if not isinstance(node, Tag):
            continue
        text = node.get_text(" ", strip=True)
        if len(text) >= 24:
            count += 1
    return count


def _looks_like_js_shell(html: str, soup: BeautifulSoup) -> bool:
    lowered = (html or "").lower()
    has_shell_hint = any(hint in lowered for hint in JS_SHELL_HINTS)
    return has_shell_hint and _text_block_count(soup) <= 2


def _looks_like_blocked_page(html: str) -> bool:
    lowered = (html or "").lower()
    if not lowered:
        return False
    return any(hint in lowered[:12000] for hint in BLOCKED_PAGE_HINTS)


def _looks_like_corrupted_payload(html: str) -> bool:
    sample = (html or "")[:5000]
    if len(sample) < 400:
        return False

    lowered = sample.lower()
    if "<html" in lowered or "<body" in lowered or "<!doctype" in lowered:
        return False

    replacement_count = sample.count("�")
    lt_count = sample.count("<")
    gt_count = sample.count(">")
    control_count = sum(1 for ch in sample if ord(ch) < 9 or (13 < ord(ch) < 32))
    weird_count = sum(1 for ch in sample if not (ch.isalnum() or ch.isspace() or ch in "<>=/\"'.,;:!?-_|()[]{}"))

    mostly_not_html = lt_count < 8 and gt_count < 8
    noisy_text = replacement_count > 20 or control_count > 20 or (weird_count / max(1, len(sample)) > 0.25)
    return mostly_not_html and noisy_text


def _looks_unusable_html(soup: BeautifulSoup) -> bool:
    has_title = bool(soup.title and (soup.title.string or "").strip())
    has_h1 = bool(soup.find("h1"))
    text_blocks = _text_block_count(soup)

    if not has_title and not has_h1 and text_blocks <= 1:
        return True

    visible_text = soup.get_text(" ", strip=True)[:4000]
    if len(visible_text) < 300:
        return False

    weird_count = sum(
        1
        for ch in visible_text
        if not (ch.isalnum() or ch.isspace() or ch in ".,;:!?\"'()[]{}-_/@#%&")
    )
    weird_ratio = weird_count / max(1, len(visible_text))
    if text_blocks <= 3 and weird_ratio > 0.20:
        return True

    return False


def _fetch_html_playwright(url: str) -> str:
    try:
        from playwright.sync_api import sync_playwright
    except Exception:
        return ""

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(user_agent="Mozilla/5.0")
            page.goto(url, wait_until="domcontentloaded", timeout=45000)
            try:
                page.wait_for_load_state("networkidle", timeout=8000)
            except Exception:
                pass

            for selector in [
                "button:has-text('Accept')",
                "button:has-text('Agree')",
                "button:has-text('I agree')",
                "button:has-text('Allow all')",
                "button:has-text('Continue without agreeing')",
                "text=Accept",
                "text=Agree and close",
                "text=Continue without agreeing",
            ]:
                try:
                    locator = page.locator(selector).first
                    if locator.count() > 0:
                        locator.click(timeout=1500)
                        break
                except Exception:
                    continue

            try:
                page.mouse.wheel(0, 1200)
                page.wait_for_timeout(500)
            except Exception:
                pass

            page.wait_for_timeout(1500)
            html = page.content()
            browser.close()
            return html or ""
    except Exception:
        return ""


def _fetch_html(url: str) -> str:
    html, status_code = _fetch_html_requests(url)

    if status_code in {401, 403, 429, 451, 503}:
        rendered = _fetch_html_playwright(url)
        if rendered:
            return rendered
        return html

    if not html:
        rendered = _fetch_html_playwright(url)
        if rendered:
            return rendered
        return html

    if _looks_like_blocked_page(html) or _looks_like_corrupted_payload(html):
        rendered = _fetch_html_playwright(url)
        if rendered:
            return rendered
        return html

    soup = BeautifulSoup(html, "lxml")
    if _looks_unusable_html(soup):
        rendered = _fetch_html_playwright(url)
        if rendered:
            return rendered
        return html

    if not _looks_like_js_shell(html, soup):
        return html

    rendered = _fetch_html_playwright(url)
    if not rendered:
        return html

    rendered_soup = BeautifulSoup(rendered, "lxml")
    if _text_block_count(rendered_soup) > _text_block_count(soup):
        return rendered
    return html


def fetch_blocks(url: str) -> Tuple[str, List[Dict]]:
    html = _fetch_html(url)
    soup = BeautifulSoup(html, "lxml")
    html_title = (soup.title.string or "").strip() if soup.title and soup.title.string else ""

    root = _pick_content_root(soup)

    nodes: List[Tag] = []
    for descendant in root.descendants:
        if not isinstance(descendant, Tag):
            continue

        tag_name = (descendant.name or "").lower()
        if tag_name in IGNORED_TAGS:
            continue
        if _is_inside_noise(descendant):
            continue
        nodes.append(descendant)

    blocks = []
    total = max(1, len(nodes))
    for i, node in enumerate(nodes, start=1):
        tag = (node.name or "").lower()
        text = node.get_text(" ", strip=True)

        media_src = ""
        media_alt = ""
        if tag == "img":
            media_src = (
                node.get("src")
                or node.get("data-src")
                or node.get("data-lazy-src")
                or _first_src_from_srcset(node.get("srcset") or node.get("data-srcset") or "", url)
                or ""
            )
            media_alt = node.get("alt") or ""
        elif tag in {"video", "iframe"}:
            media_src = node.get("src") or ""
        elif tag == "figure":
            img = node.find("img")
            if img:
                media_src = (
                    img.get("src")
                    or img.get("data-src")
                    or img.get("data-lazy-src")
                    or _first_src_from_srcset(img.get("srcset") or img.get("data-srcset") or "", url)
                    or ""
                )
                media_alt = img.get("alt") or ""

        media_src = _normalize_media_src(media_src, url)

        block_type = "text"
        role = "paragraph"
        if tag in {"img", "figure"}:
            block_type = "image"
            role = "image"
        elif tag in {"video", "iframe"}:
            block_type = "video"
            role = "video_embed"
        elif tag in {"h1", "h2", "h3"}:
            role = "heading"
        elif tag == "li":
            role = "list_item"
        elif tag == "blockquote":
            role = "blockquote"

        class_list = node.get("class") or []
        parent_classes = node.parent.get("class") if node.parent and isinstance(node.parent, Tag) else []

        block = {
            "order": i,
            "type": block_type,
            "role": role,
            "content": text if block_type == "text" else media_src,
            "text": {
                "clean": text,
                "charCount": len(text),
                "wordCount": len(text.split()),
                "sentenceCount": max(1, text.count(".") + text.count("!") + text.count("?")) if text else 0,
                "punctuationRatio": 0.0,
                "linkDensity": _link_density(node, text),
            },
            "media": {
                "src": media_src,
                "alt": media_alt,
            } if block_type in {"image", "video"} else {},
            "structure": {
                "tag": tag,
                "parentTag": node.parent.name if node.parent and isinstance(node.parent, Tag) else "",
                "depth": _node_depth(node),
                "siblingIndex": _sibling_index(node),
                "siblingCount": _sibling_count(node),
                "sectionIndex": 1,
            },
            "attributes": {
                "id": node.get("id") or "",
                "classList": class_list,
                "parentClassList": parent_classes or [],
                "role": node.get("role") or "",
                "hasAnchorAncestor": _has_anchor_ancestor(node),
            },
            "position": {
                "domOrder": i,
                "relativePosition": i / total,
                "visual": {
                    "normalizedY": i / total,
                    "normalizedHeight": 0.01,
                },
            },
        }
        blocks.append(block)

    return html_title, blocks


def predict_blocks(blocks: List[Dict], checkpoint: Dict, device: torch.device):
    enc = checkpoint["encoders"]
    cfg = checkpoint["config"]

    model = BlockClassifier(
        vocab_size=len(enc["vocab"]),
        tag_vocab_size=len(enc["tag2id"]),
        num_numeric=cfg["num_numeric"],
        num_labels=len(enc["label2id"]),
        token_dim=cfg["token_dim"],
        tag_dim=cfg["tag_dim"],
        hidden_dim=cfg["hidden_dim"],
        dropout=cfg["dropout"],
    ).to(device)
    model.load_state_dict(checkpoint["model_state"])
    model.eval()

    mean = torch.tensor(enc["num_mean"], dtype=torch.float32, device=device)
    std = torch.tensor(enc["num_std"], dtype=torch.float32, device=device)

    vocab = enc["vocab"]
    unk_id = vocab.get("<unk>", 1)
    tag2id = enc["tag2id"]
    id2label = {int(k): v for k, v in enc["id2label"].items()} if isinstance(next(iter(enc["id2label"].keys())), str) else enc["id2label"]

    outputs = []
    with torch.no_grad():
        for block in blocks:
            token_ids = [unk_id]
            token_t = torch.tensor([token_ids], dtype=torch.long, device=device)
            mask_t = torch.ones_like(token_t, dtype=torch.float32)

            tag = get_tag(block)
            tag_id = tag2id.get(tag, tag2id.get("<unk>", 0))
            tag_t = torch.tensor([tag_id], dtype=torch.long, device=device)

            num = torch.tensor([numeric_features(block)], dtype=torch.float32, device=device)
            num = (num - mean) / std

            logits = model(token_t, mask_t, tag_t, num)
            probs = torch.softmax(logits, dim=1)[0]
            score, pred_idx = torch.max(probs, dim=0)

            outputs.append(
                {
                    "block": block,
                    "label": id2label[int(pred_idx.item())],
                    "score": float(score.item()),
                    "probs": probs.detach().cpu().tolist(),
                }
            )

    return outputs


def extract(url: str, model_path: str, text_thr: float, media_thr: float, title_thr: float) -> Dict:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    checkpoint = torch.load(model_path, map_location=device)

    html_title, blocks = fetch_blocks(url)
    if not blocks:
        return {"url": url, "title": html_title, "content": []}

    predictions = predict_blocks(blocks, checkpoint, device)
    class_index = {label: int(idx) for label, idx in checkpoint["encoders"]["label2id"].items()}
    title_idx = class_index.get("TITLE")

    html_title_overlap = _title_overlap_score(html_title, url) if html_title else 0.0
    best_title_text = html_title
    best_title_score = (html_title_overlap * 1.4) + (0.22 if html_title else float("-inf"))
    for pred in predictions:
        block = pred["block"]
        probs = pred["probs"]
        title_prob = float(probs[title_idx]) if title_idx is not None else 0.0
        text = (block.get("text", {}) or {}).get("clean", "")
        tag = ((block.get("structure") or {}).get("tag") or "").lower()
        overlap_score = _title_overlap_score(text, url)
        candidate_score = _title_candidate_score(block, title_prob) + (overlap_score * 0.75)

        replace_margin = 0.18 if html_title else 0.08
        if candidate_score <= best_title_score + replace_margin:
            continue
        if title_prob < title_thr:
            continue
        if html_title and tag != "h1" and html_title_overlap >= 0.45 and overlap_score < html_title_overlap + 0.15:
            continue
        if text:
            best_title_text = text
        best_title_score = candidate_score

    selected = []
    seen_text = set()
    seen_media = set()
    text_kept = 0
    card_streak = 0
    article_started = False
    pre_start_image = None
    pre_start_has_teaser_text = False
    for pred in predictions:
        block = pred["block"]
        label = pred["label"]
        score = pred["score"]

        # Once the extractor reaches a related-content section, stop collecting
        # so sidebar links and recommendation cards do not bleed into results.
        block_text = (block.get("text", {}) or {}).get("clean", "")
        block_attrs = block.get("attributes") or {}
        block_position = float((block.get("position") or {}).get("relativePosition") or 1.0)
        link_density = float(((block.get("text") or {}).get("linkDensity") or 0.0))
        stop_like = _has_stop_section_hint(block_text, block_attrs)
        if (
            article_started
            and text_kept >= 4
            and block_position >= 0.35
            and stop_like
            and (link_density > 0.45 or _is_card_like_block(block, label))
        ):
            break

        if len(selected) >= 6 and _is_card_like_block(block, label):
            card_streak += 1
        else:
            card_streak = 0

        # Structural boundary detection: if article body started and then
        # card-like blocks appear consecutively, we likely entered a recommendations rail.
        if text_kept >= 3 and card_streak >= 3:
            break

        block_tag = (block.get("structure", {}) or {}).get("tag", "") or ""
        block_tag = block_tag.lower()
        block_text_len = len((block_text or "").strip())
        bodyish_text = (
            label == "TEXT"
            and score >= text_thr
            and block_tag in {"p", "blockquote"}
            and block_text_len >= 140
            and link_density < 0.35
        )
        intro_text = (
            label == "TEXT"
            and score >= text_thr
            and block_tag in {"p", "blockquote"}
            and block_text_len >= 80
            and link_density < 0.45
            and block_position <= 0.65
        )
        short_intro_text = (
            label == "TEXT"
            and score >= text_thr
            and block_tag in {"p", "blockquote"}
            and block_text_len >= 45
            and link_density < 0.30
            and block_position <= 0.35
        )

        if label == "TEXT" and score >= text_thr:
            text_value = block_text
            text_key = _norm_text_for_dedup(text_value)
            if not text_key or text_key in seen_text:
                continue
            if _is_credit_or_source_line(text_value, block):
                continue
            if _is_ui_noise_text(text_value):
                continue
            if len(text_key) < 6 and len(selected) >= 3:
                continue
            if link_density > 0.55 and len(selected) >= 2:
                continue
            if _is_card_like_block(block, label) and text_kept >= 2:
                continue
            if not article_started and not (bodyish_text or intro_text or short_intro_text):
                if (
                    len(text_key) < 80
                    and (
                        _is_card_like_block(block, label)
                        or link_density > 0.55
                        or stop_like
                    )
                ):
                    pre_start_has_teaser_text = True
                continue
            if not article_started and pre_start_image and not pre_start_has_teaser_text:
                seen_media.add(pre_start_image["_media_key"])
                selected.append(
                    {
                        "order": len(selected) + 1,
                        "type": "image",
                        "src": pre_start_image["src"],
                        "alt": pre_start_image["alt"],
                        "score": pre_start_image["score"],
                    }
                )
                pre_start_image = None
            seen_text.add(text_key)
            selected.append({
                "order": len(selected) + 1,
                "type": "text",
                "text": text_value,
                "score": float(score),
            })
            text_kept += 1
            if bodyish_text or intro_text or short_intro_text:
                article_started = True
        elif label == "IMAGE" and score >= min(media_thr, 0.28):
            if not article_started:
                if (
                    pre_start_image is None
                    and text_kept == 0
                    and score >= max(media_thr, 0.75)
                    and block_position <= 0.25
                    and len((block.get("media", {}) or {}).get("alt", "")) >= 35
                ):
                    media_src = (block.get("media", {}) or {}).get("src", "")
                    media_key = _media_similarity_key(media_src)
                    if media_key:
                        pre_start_image = {
                            "src": media_src,
                            "alt": (block.get("media", {}) or {}).get("alt", ""),
                            "score": float(score),
                            "_media_key": media_key,
                        }
                continue
            media_src = (block.get("media", {}) or {}).get("src", "")
            # Use similarity key to detect same image even with size variants
            if not _is_valid_media_src(media_src):
                continue
            media_key = _media_similarity_key(media_src)
            if not media_key or media_key in seen_media:
                continue
            media_alt = (block.get("media", {}) or {}).get("alt", "")
            if not media_alt and block_position >= 0.40:
                continue
            if _is_card_like_block(block, label) and text_kept >= 1:
                continue
            seen_media.add(media_key)
            selected.append({
                "order": len(selected) + 1,
                "type": "image",
                "src": media_src,
                "alt": (block.get("media", {}) or {}).get("alt", ""),
                "score": float(score),
            })
        elif label == "VIDEO" and score >= media_thr:
            if not article_started:
                continue
            media_src = (block.get("media", {}) or {}).get("src", "")
            # Use similarity key for video as well
            media_key = _media_similarity_key(media_src)
            if not media_key or media_key in seen_media:
                continue
            seen_media.add(media_key)
            selected.append({
                "order": len(selected) + 1,
                "type": label.lower(),
                "src": media_src,
                "alt": (block.get("media", {}) or {}).get("alt", ""),
                "score": float(score),
            })

    if pre_start_image and not pre_start_has_teaser_text:
        media_key = pre_start_image["_media_key"]
        if media_key not in seen_media:
            seen_media.add(media_key)
            selected.insert(
                0,
                {
                    "order": 1,
                    "type": "image",
                    "src": pre_start_image["src"],
                    "alt": pre_start_image["alt"],
                    "score": pre_start_image["score"],
                },
            )
            for idx, item in enumerate(selected, start=1):
                item["order"] = idx

    return {
        "url": url,
        "title": best_title_text,
        "content": selected,
        "modelLabels": list(checkpoint["encoders"]["label2id"].keys()),
    }
