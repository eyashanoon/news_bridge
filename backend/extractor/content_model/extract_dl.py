import argparse
import json
import re
from typing import Dict, List, Tuple
from urllib.parse import urljoin, urlparse

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
    "you may like",
    "also read",
    "read next",
    "suggested",
    "latest",
    "read more",
    "more stories",
    "you might like",
    "recommended stories",
    "popular stories",
    "trending",
    "editor picks",
    "most popular",
    "around the web",
    "from our network",
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
    "also-read",
    "read-next",
    "more-stories",
    "suggested",
    "outbrain",
    "grid-item",
    "listicle",
    "sidebar",
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


NOISE_TOKEN_HINTS = {"nav", "menu", "header", "footer", "share", "social"}

PRUNE_TAGS = {"nav", "footer", "header", "aside", "form", "button"}

RECOMMENDATION_HINTS = {
    "related",
    "recommend",
    "more-from",
    "more-stories",
    "also-read",
    "read-next",
    "read-more",
    "popular",
    "trending",
    "most-read",
    "editor-pick",
    "suggested",
    "outbrain",
    "taboola",
    "story-card",
    "article-card",
    "teaser",
    "promo-block",
    "sidebar",
    "rail",
    "widget",
    "grid-item",
    "listicle",
    "shorts",
    "short-video",
    "vertical-video",
    "reels",
    "reel",
    "story-card",
    "video-card",
    "clip-card",
}

THUMBNAIL_URL_RE = re.compile(
    r"(?i)(?:/thumb(?:nail)?s?/|_thumb(?:nail)?|[-_]thumb(?:nail)?|"
    r"/(?:xs|sm|small|icon|avatar|sprite|shorts|reels?)/|"
    r"(?:[?&](?:w|width|h|height)=\d{1,3}(?:&|$))|"
    r"[-_/]\d{2,3}x\d{2,3}(?:[-_./]|$))"
)

SHORT_VIDEO_URL_RE = re.compile(
    r"(?i)(?:/shorts/|youtube\.com/shorts|youtu\.be/shorts|"
    r"/reels?/|instagram\.com/reel|tiktok\.com/|vm\.tiktok|"
    r"/stories/|vertical[-_]?video|short[-_]?video|/clips?/)"
)

URL_DIMENSION_RE = re.compile(
    r"(?i)(?:[?&](?:w|width)=(\d{1,4})|[?&](?:h|height)=(\d{1,4})|[-_/](\d{2,4})x(\d{2,4})(?:[-_./]|$))"
)

# Recommendation/noise thumbnails — used inside related-content heuristics.
SMALL_IMAGE_MAX_PX = 120
# Minimum rendered size for an image to be treated as article body media.
MIN_ARTICLE_IMAGE_PX = 200
# Below this size, videos/iframes need very high model confidence.
SMALL_VIDEO_MAX_PX = 240


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


def _parse_dimension(value) -> int:
    if value is None:
        return 0
    cleaned = re.sub(r"[^\d]", "", str(value).strip())
    if not cleaned:
        return 0
    try:
        return int(cleaned)
    except ValueError:
        return 0


def _dimensions_from_style(node: Tag) -> Tuple[int, int]:
    style = node.get("style") or ""
    width = height = 0
    width_match = re.search(r"(?:^|;|\s)width:\s*(\d+)", style, re.I)
    height_match = re.search(r"(?:^|;|\s)height:\s*(\d+)", style, re.I)
    if width_match:
        width = int(width_match.group(1))
    if height_match:
        height = int(height_match.group(1))
    return width, height


def _dimensions_from_url(src: str) -> Tuple[int, int]:
    if not src:
        return 0, 0
    width = height = 0
    for match in URL_DIMENSION_RE.finditer(src):
        if match.group(1):
            width = max(width, int(match.group(1)))
        if match.group(2):
            height = max(height, int(match.group(2)))
        if match.group(3) and match.group(4):
            width = max(width, int(match.group(3)))
            height = max(height, int(match.group(4)))
    return width, height


def _best_src_from_srcset(srcset: str, base_url: str) -> Tuple[str, int]:
    if not srcset:
        return "", 0
    best_src = ""
    best_width = 0
    for entry in srcset.split(","):
        parts = entry.strip().split()
        if not parts:
            continue
        candidate_src = _normalize_media_src(parts[0], base_url)
        candidate_width = 0
        for token in parts[1:]:
            if token.endswith("w"):
                candidate_width = _parse_dimension(token[:-1])
                break
        if candidate_width > best_width:
            best_width = candidate_width
            best_src = candidate_src
    if not best_src:
        best_src = _first_src_from_srcset(srcset, base_url)
    return best_src, best_width


def _resolve_media_dimensions(
    node: Tag,
    img_node: Tag | None,
    media_src: str,
    srcset: str = "",
) -> Tuple[int, int]:
    target = img_node or node
    width = _parse_dimension(
        target.get("width")
        or target.get("data-width")
        or node.get("width")
        or node.get("data-width")
    )
    height = _parse_dimension(
        target.get("height")
        or target.get("data-height")
        or node.get("height")
        or node.get("data-height")
    )

    style_width, style_height = _dimensions_from_style(target)
    width = width or style_width
    height = height or style_height

    if srcset:
        _, srcset_width = _best_src_from_srcset(srcset, "")
        if srcset_width > width:
            width = srcset_width

    url_width, url_height = _dimensions_from_url(media_src)
    if url_width and not width:
        width = url_width
    if url_height and not height:
        height = url_height

    return width, height


def _get_media_dimensions(block: Dict) -> Tuple[int, int]:
    media = block.get("media") or {}
    width = _parse_dimension(media.get("width"))
    height = _parse_dimension(media.get("height"))
    if not width or not height:
        url_width, url_height = _dimensions_from_url(media.get("src") or "")
        width = width or url_width
        height = height or url_height
    return width, height


def _max_media_dimension(block: Dict) -> int:
    width, height = _get_media_dimensions(block)
    return max(width, height, 0)


def _is_thumbnail_url(src: str) -> bool:
    if not src:
        return False
    return bool(THUMBNAIL_URL_RE.search(src))


def _is_recommendation_container(node: Tag) -> bool:
    haystack = _class_id_text(node)
    if not haystack:
        return False
    return any(hint in haystack for hint in RECOMMENDATION_HINTS)


def _is_inside_recommendation(node: Tag) -> bool:
    cur = node
    while cur and isinstance(cur, Tag):
        tag_name = (cur.name or "").lower()
        if tag_name in {"body", "html"}:
            break
        if tag_name in PRUNE_TAGS:
            return True
        if _is_recommendation_container(cur):
            return True
        cur = cur.parent
    return False


def _count_sibling_images(node: Tag) -> int:
    if not node.parent or not isinstance(node.parent, Tag):
        return 0
    return sum(
        1
        for child in node.parent.children
        if isinstance(child, Tag) and (child.name or "").lower() in {"img", "figure", "picture"}
    )


def _linked_image_units(container: Tag) -> List[Tag]:
    units: List[Tag] = []
    for child in container.children:
        if not isinstance(child, Tag):
            continue
        child_tag = (child.name or "").lower()
        if child_tag in {"img", "figure", "picture"}:
            units.append(child)
            continue
        if child_tag == "a" and child.find(["img", "figure", "picture"]):
            units.append(child)
    return units


def _is_in_image_link_grid(node: Tag, max_depth: int = 5) -> bool:
    cur = node
    depth = 0
    while cur and isinstance(cur, Tag) and depth < max_depth:
        units = _linked_image_units(cur)
        if len(units) >= 3:
            linked = sum(
                1
                for unit in units
                if (unit.name or "").lower() == "a" or _has_anchor_ancestor(unit)
            )
            if linked >= 2:
                return True

        nested_imgs = cur.find_all(["img", "figure", "picture"], recursive=False)
        if len(nested_imgs) >= 3:
            linked = sum(1 for img in nested_imgs if _has_anchor_ancestor(img))
            if linked >= 2:
                return True

        cur = cur.parent
        depth += 1
    return False


def _container_link_density(node: Tag, max_depth: int = 4) -> float:
    cur = node
    depth = 0
    while cur and isinstance(cur, Tag) and depth < max_depth:
        text = cur.get_text(" ", strip=True)
        if len(text) >= 40:
            return _link_density(cur, text)
        cur = cur.parent
        depth += 1
    return 0.0


def _prune_noise_subtrees(root: Tag) -> None:
    for tag_name in PRUNE_TAGS:
        for node in list(root.find_all(tag_name)):
            if isinstance(node, Tag):
                node.decompose()

    for node in list(root.find_all(True)):
        if not isinstance(node, Tag) or node.parent is None:
            continue
        if not _is_recommendation_container(node) and not _is_noise_node(node):
            continue
        paragraph_count = len(node.find_all("p"))
        if paragraph_count >= 4:
            continue
        node.decompose()


def _content_focus_score(node: Tag) -> float:
    words = sum(len(p.get_text(" ", strip=True).split()) for p in node.find_all("p"))
    links = len(node.find_all("a"))
    linked_imgs = sum(1 for img in node.find_all("img") if _has_anchor_ancestor(img))
    return float(words - (links * 2) - (linked_imgs * 10))


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

    scored = [(node, _score_container(node)) for node in candidates]
    best_score = max(score for _, score in scored)
    top_candidates = [node for node, score in scored if score >= best_score * 0.85]
    return max(top_candidates, key=_content_focus_score)


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

    parent_is_list = parent_tag in {"li", "ul", "ol"}
    in_link_grid = bool(attrs.get("inImageLinkGrid"))
    sibling_imgs = int(structure.get("siblingImgCount") or 0)

    if label in {"IMAGE", "VIDEO"}:
        if card_hint or in_link_grid:
            return True
        if linked_context and (parent_is_list or sibling_imgs >= 2):
            return True
        if parent_is_list and linked_context:
            return True
        return False

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
    if "avatar" in lowered or "sprite" in lowered or "logo" in lowered:
        return False
    parsed = urlparse(src)
    if not parsed.scheme:
        return False
    return True


def _is_short_video_url(src: str) -> bool:
    if not src:
        return False
    return bool(SHORT_VIDEO_URL_RE.search(src))


def _is_below_min_article_image_size(block: Dict) -> bool:
    width, height = _get_media_dimensions(block)
    if width and height:
        return width < MIN_ARTICLE_IMAGE_PX or height < MIN_ARTICLE_IMAGE_PX
    max_dim = max(width, height)
    if max_dim:
        return max_dim < MIN_ARTICLE_IMAGE_PX
    return False


def _is_small_image(block: Dict) -> bool:
    if _is_below_min_article_image_size(block):
        return True
    media = block.get("media") or {}
    width = _parse_dimension(media.get("width"))
    height = _parse_dimension(media.get("height"))
    if width and height and (width < SMALL_IMAGE_MAX_PX or height < SMALL_IMAGE_MAX_PX):
        return True
    if width and width < SMALL_IMAGE_MAX_PX:
        return True
    if height and height < SMALL_IMAGE_MAX_PX:
        return True
    return False


def _is_recommendation_media(block: Dict, label: str, text_kept: int) -> bool:
    if label != "IMAGE":
        return False
    if _is_card_like_block(block, label):
        return True

    structure = block.get("structure") or {}
    attrs = block.get("attributes") or {}
    media = block.get("media") or {}
    parent_tag = (structure.get("parentTag") or "").lower()
    position = float((block.get("position") or {}).get("relativePosition") or 1.0)
    media_src = (media.get("src") or "").strip()
    media_alt = (media.get("alt") or "").strip()
    container_link_density = float(attrs.get("containerLinkDensity") or 0.0)

    if _is_thumbnail_url(media_src):
        return True
    if _is_small_image(block):
        return True
    if attrs.get("inImageLinkGrid"):
        return True
    sibling_imgs = int(structure.get("siblingImgCount") or 0)
    if sibling_imgs >= 3:
        return True
    if sibling_imgs >= 2 and attrs.get("hasAnchorAncestor"):
        return True

    if parent_tag in {"li", "ul", "ol"} and attrs.get("hasAnchorAncestor"):
        return True

    if attrs.get("hasAnchorAncestor"):
        if container_link_density > 0.35:
            return True
        if position >= 0.30 and len(media_alt) < 60 and text_kept >= 2:
            return True

    if position >= 0.55 and not media_alt and parent_tag not in {"figure", "picture"}:
        return True

    return False


def _effective_video_threshold(block: Dict, media_thr: float) -> float:
    structure = block.get("structure") or {}
    tag = (structure.get("tag") or "").lower()
    attrs = block.get("attributes") or {}
    position = float((block.get("position") or {}).get("relativePosition") or 1.0)

    threshold = max(0.78, media_thr) if tag == "video" else max(0.82, media_thr)
    if attrs.get("hasAnchorAncestor") or attrs.get("inImageLinkGrid"):
        threshold = max(threshold, 0.86)
    if position > 0.45:
        threshold = max(threshold, 0.84)
    if _max_media_dimension(block) and _max_media_dimension(block) < SMALL_VIDEO_MAX_PX:
        threshold = max(threshold, 0.90)
    return threshold


def _is_recommendation_video(block: Dict, text_kept: int) -> bool:
    if _is_card_like_block(block, "VIDEO"):
        return True

    structure = block.get("structure") or {}
    attrs = block.get("attributes") or {}
    media = block.get("media") or {}
    media_src = (media.get("src") or "").strip()
    position = float((block.get("position") or {}).get("relativePosition") or 1.0)
    container_link_density = float(attrs.get("containerLinkDensity") or 0.0)

    if _is_short_video_url(media_src):
        return True
    if attrs.get("inImageLinkGrid"):
        return True
    if int(structure.get("siblingImgCount") or 0) >= 3:
        return True
    if attrs.get("hasAnchorAncestor") and text_kept >= 2:
        return True
    if container_link_density > 0.35 and text_kept >= 2:
        return True
    if position >= 0.55 and attrs.get("hasAnchorAncestor"):
        return True

    class_haystack = " ".join(
        [
            str(attrs.get("id") or "").lower(),
            " ".join(attrs.get("classList") or []).lower(),
            " ".join(attrs.get("parentClassList") or []).lower(),
        ]
    )
    if any(
        hint in class_haystack
        for hint in {
            "sidebar",
            "related",
            "recommend",
            "widget",
            "rail",
            "teaser",
            "shorts",
            "reels",
            "story-card",
            "video-card",
            "clip-card",
            "vertical-video",
        }
    ):
        return True

    max_dim = _max_media_dimension(block)
    if max_dim and max_dim < SMALL_VIDEO_MAX_PX and position >= 0.35:
        return True

    return False


def _should_keep_article_image(block: Dict, score: float, media_thr: float, text_kept: int) -> bool:
    if score < _effective_image_threshold(block, media_thr):
        return False
    if _is_recommendation_media(block, "IMAGE", text_kept):
        return False

    media_src = (block.get("media", {}) or {}).get("src", "")
    if not _is_valid_media_src(media_src):
        return False
    if _is_thumbnail_url(media_src):
        return False
    if _is_below_min_article_image_size(block):
        return False

    max_dim = _max_media_dimension(block)
    attrs = block.get("attributes") or {}
    position = float((block.get("position") or {}).get("relativePosition") or 1.0)

    if max_dim and max_dim < MIN_ARTICLE_IMAGE_PX + 120:
        if score < max(_effective_image_threshold(block, media_thr), 0.80):
            return False

    if not max_dim:
        if _is_card_like_block(block, "IMAGE"):
            return False
        if attrs.get("hasAnchorAncestor"):
            media_alt = (block.get("media", {}) or {}).get("alt", "")
            parent_tag = ((block.get("structure") or {}).get("parentTag") or "").lower()
            in_semantic_figure = parent_tag in {"figure", "picture"} or (
                (block.get("structure") or {}).get("tag") or ""
            ).lower() == "figure"
            if not in_semantic_figure:
                return False
            if len(media_alt) < 40:
                return False
            if score < 0.90:
                return False
        if position >= 0.50 and score < 0.82:
            return False

    return True


def _should_keep_article_video(block: Dict, score: float, media_thr: float, text_kept: int) -> bool:
    media_src = (block.get("media", {}) or {}).get("src", "")
    if not _is_valid_media_src(media_src):
        return False
    if _is_short_video_url(media_src):
        return False
    if _is_recommendation_video(block, text_kept):
        return False
    if score < _effective_video_threshold(block, media_thr):
        return False

    max_dim = _max_media_dimension(block)
    if max_dim and max_dim < SMALL_VIDEO_MAX_PX and score < 0.88:
        return False

    return True


def _effective_image_threshold(block: Dict, media_thr: float) -> float:
    structure = block.get("structure") or {}
    tag = (structure.get("tag") or "").lower()
    parent_tag = (structure.get("parentTag") or "").lower()
    position = float((block.get("position") or {}).get("relativePosition") or 1.0)
    attrs = block.get("attributes") or {}

    if tag == "figure" or parent_tag in {"figure", "picture"}:
        # Recommendation cards often wrap linked thumbnails in <figure>; do not
        # apply the hero-image threshold discount in that case.
        if attrs.get("hasAnchorAncestor") or attrs.get("inImageLinkGrid"):
            return max(0.72, media_thr)
        return max(0.50, media_thr * 0.72)

    if attrs.get("hasAnchorAncestor") or attrs.get("inImageLinkGrid"):
        return max(0.68, media_thr)

    if position > 0.45:
        return max(0.58, media_thr * 0.85)

    return max(0.52, media_thr * 0.75)


def _link_density(node: Tag, text: str) -> float:
    if not text:
        return 0.0
    link_text_len = 0
    for a in node.find_all("a"):
        link_text_len += len(a.get_text(" ", strip=True))
    return link_text_len / max(1, len(text))


def _fetch_html(url: str) -> str:
    from web_fetch import fetch_html

    result = fetch_html(url, profile="news", timeout=30, allow_browser=True)
    return result.html or ""


def fetch_blocks(url: str, html: str | None = None) -> Tuple[str, List[Dict]]:
    if html is None:
        html = _fetch_html(url)
    soup = BeautifulSoup(html, "lxml")
    html_title = (soup.title.string or "").strip() if soup.title and soup.title.string else ""

    root = _pick_content_root(soup)
    _prune_noise_subtrees(root)

    nodes: List[Tag] = []
    for descendant in root.descendants:
        if not isinstance(descendant, Tag):
            continue

        tag_name = (descendant.name or "").lower()
        if tag_name in IGNORED_TAGS:
            continue
        if _is_inside_noise(descendant):
            continue
        if _is_inside_recommendation(descendant):
            continue
        nodes.append(descendant)

    blocks = []
    total = max(1, len(nodes))
    for i, node in enumerate(nodes, start=1):
        tag = (node.name or "").lower()
        text = node.get_text(" ", strip=True)

        media_src = ""
        media_alt = ""
        media_width = ""
        media_height = ""
        img_node = None
        srcset = ""
        if tag == "img":
            parent = node.parent
            if parent and isinstance(parent, Tag) and (parent.name or "").lower() == "picture":
                continue
            img_node = node
            srcset = node.get("srcset") or node.get("data-srcset") or ""
            best_src, _ = _best_src_from_srcset(srcset, url) if srcset else ("", 0)
            media_src = (
                node.get("src")
                or node.get("data-src")
                or node.get("data-lazy-src")
                or best_src
                or _first_src_from_srcset(srcset, url)
                or ""
            )
            media_alt = node.get("alt") or ""
            media_width = node.get("width") or node.get("data-width") or ""
            media_height = node.get("height") or node.get("data-height") or ""
        elif tag == "picture":
            img = node.find("img")
            if not img:
                continue
            img_node = img
            srcset = img.get("srcset") or img.get("data-srcset") or ""
            best_src, _ = _best_src_from_srcset(srcset, url) if srcset else ("", 0)
            media_src = (
                img.get("src")
                or img.get("data-src")
                or img.get("data-lazy-src")
                or best_src
                or _first_src_from_srcset(srcset, url)
                or ""
            )
            media_alt = img.get("alt") or ""
            media_width = img.get("width") or img.get("data-width") or ""
            media_height = img.get("height") or img.get("data-height") or ""
        elif tag in {"video", "iframe"}:
            media_src = (
                node.get("src")
                or node.get("data-src")
                or node.get("data-lazy-src")
                or ""
            )
            if not media_src and tag == "video":
                source = node.find("source")
                if source:
                    media_src = source.get("src") or source.get("data-src") or ""
            media_width = node.get("width") or node.get("data-width") or ""
            media_height = node.get("height") or node.get("data-height") or ""
        elif tag == "figure":
            img = node.find("img")
            if img:
                img_node = img
                srcset = img.get("srcset") or img.get("data-srcset") or ""
                best_src, _ = _best_src_from_srcset(srcset, url) if srcset else ("", 0)
                media_src = (
                    img.get("src")
                    or img.get("data-src")
                    or img.get("data-lazy-src")
                    or best_src
                    or _first_src_from_srcset(srcset, url)
                    or ""
                )
                media_alt = img.get("alt") or ""
                media_width = img.get("width") or img.get("data-width") or ""
                media_height = img.get("height") or img.get("data-height") or ""

        media_src = _normalize_media_src(media_src, url)
        resolved_width, resolved_height = _resolve_media_dimensions(
            node,
            img_node,
            media_src,
            srcset,
        )
        if resolved_width:
            media_width = str(resolved_width)
        if resolved_height:
            media_height = str(resolved_height)
        sibling_img_count = _count_sibling_images(img_node or node) if tag in {"img", "figure", "picture"} else 0
        in_image_link_grid = _is_in_image_link_grid(img_node or node) if tag in {"img", "figure", "picture"} else False
        container_link_density = (
            _container_link_density(img_node or node) if tag in {"img", "figure", "picture"} else 0.0
        )

        block_type = "text"
        role = "paragraph"
        if tag in {"img", "figure", "picture"}:
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
                "width": media_width,
                "height": media_height,
            } if block_type in {"image", "video"} else {},
            "structure": {
                "tag": tag,
                "parentTag": node.parent.name if node.parent and isinstance(node.parent, Tag) else "",
                "depth": _node_depth(node),
                "siblingIndex": _sibling_index(node),
                "siblingCount": _sibling_count(node),
                "siblingImgCount": sibling_img_count,
                "sectionIndex": 1,
            },
            "attributes": {
                "id": node.get("id") or "",
                "classList": class_list,
                "parentClassList": parent_classes or [],
                "role": node.get("role") or "",
                "hasAnchorAncestor": _has_anchor_ancestor(node),
                "inImageLinkGrid": in_image_link_grid,
                "containerLinkDensity": container_link_density,
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


def extract(
    url: str,
    model_path: str,
    text_thr: float,
    media_thr: float,
    title_thr: float,
    html: str | None = None,
) -> Dict:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    checkpoint = torch.load(model_path, map_location=device)

    html_title, blocks = fetch_blocks(url, html=html)
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
    recommendation_media_streak = 0
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
        elif label == "IMAGE" and score >= _effective_image_threshold(block, media_thr):
            if _is_recommendation_media(block, label, text_kept):
                recommendation_media_streak += 1
                if text_kept >= 2 and recommendation_media_streak >= 2:
                    break
                continue
            recommendation_media_streak = 0

            if not article_started:
                if (
                    pre_start_image is None
                    and text_kept == 0
                    and _should_keep_article_image(block, score, media_thr, text_kept)
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
            if not _should_keep_article_image(block, score, media_thr, text_kept):
                continue
            media_src = (block.get("media", {}) or {}).get("src", "")
            media_key = _media_similarity_key(media_src)
            if not media_key or media_key in seen_media:
                continue
            media_alt = (block.get("media", {}) or {}).get("alt", "")
            if not media_alt and block_position >= 0.35:
                continue
            seen_media.add(media_key)
            selected.append({
                "order": len(selected) + 1,
                "type": "image",
                "src": media_src,
                "alt": media_alt,
                "score": float(score),
            })
        elif label == "VIDEO" and score >= _effective_video_threshold(block, media_thr):
            if not article_started:
                continue
            if not _should_keep_article_video(block, score, media_thr, text_kept):
                continue
            media_src = (block.get("media", {}) or {}).get("src", "")
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
