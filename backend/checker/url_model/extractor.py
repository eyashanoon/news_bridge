"""
extractor.py — Generic news-article feature extractor.
Works with any domain using adaptive, domain-agnostic extraction.
"""

from bs4 import BeautifulSoup
import re
import json
import logging
from math import log1p

try:
    from .utils import fetch_html
except ImportError:
    from utils import fetch_html


logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# GENERIC SELECTORS - Work across most sites
# ─────────────────────────────────────────────────────────────────────────────
GENERIC_SELECTORS = [
    "article",
    "main article",
    ".article-body", ".article__body", ".article-content", "[class*='ArticleBody']",
    ".post-content", ".post-body", ".entry-content",
    ".content-body", ".body-content", "[class*='body-content']",
    ".story-body", "[class*='storyBody']",
    "[role='main']",
    "div[class*='content']",
]


def _domain(url):
    """Extract domain from URL"""
    m = re.search(r'https?://(?:www\.)?([^/]+)', url)
    return m.group(1) if m else ""


def is_non_article_by_rule(url):
    """
    Generic rules: reject nav/hub/search pages based on URL patterns.
    Much simpler than site-specific rules.
    """
    path = url.lower()
    
    # Reject common non-article patterns
    reject_patterns = [
        r'/(search|find|query)\?', r'/(category|tag|archive|author|feed)',
        r'/(index|homepage|home|about|contact|privacy|terms)',
        r'(yahoo|google|bing|duckduck).*search', r'/((api|docs|help|support)(/|$))',
    ]
    
    for pattern in reject_patterns:
        if re.search(pattern, path):
            return True
    
    return False


def _extract_article_text(soup):
    """
    Try multiple generic selectors to find article content.
    Returns best candidate text (no hard minimum length).
    """
    best_text = ""
    for selector in GENERIC_SELECTORS:
        try:
            el = soup.select_one(selector)
            if el:
                text = el.get_text(separator=" ", strip=True)
                if len(text.split()) > len(best_text.split()):
                    best_text = text
        except Exception as exc:
            logger.debug("Selector failed for %s: %s", selector, exc)
            continue
    return best_text or None


def _extract_metadata(soup, url):
    """Extract title, author, date from page metadata"""
    title = ""
    author = ""
    publish_date = ""
    
    # Try common metadata sources
    og_title = soup.find("meta", property="og:title")
    if og_title:
        title = og_title.get("content", "")
    if not title:
        title_tag = soup.find("title")
        title = title_tag.get_text() if title_tag else ""
    
    # Author
    author_meta = soup.find("meta", attrs={"name": re.compile(r"author", re.I)})
    if author_meta:
        author = author_meta.get("content", "")
    
    # Publish date
    date_meta = soup.find("meta", attrs={"name": re.compile(r"publish|date", re.I)})
    if date_meta:
        publish_date = date_meta.get("content", "")
    
    return title, author, publish_date


def _extract_jsonld_flags(soup):
    """Detect JSON-LD article schema and metadata richness."""
    has_jsonld = 0
    has_jsonld_article = 0
    has_jsonld_author = 0
    has_jsonld_date = 0

    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        raw = (script.string or script.get_text() or "").strip()
        if not raw:
            continue
        has_jsonld = 1
        try:
            data = json.loads(raw)
        except Exception:
            continue

        nodes = data if isinstance(data, list) else [data]
        for node in nodes:
            if not isinstance(node, dict):
                continue
            node_type = str(node.get("@type", "")).lower()
            if "article" in node_type or "newsarticle" in node_type or "blogposting" in node_type:
                has_jsonld_article = 1
            if node.get("author"):
                has_jsonld_author = 1
            if node.get("datePublished") or node.get("dateModified"):
                has_jsonld_date = 1

    return has_jsonld, has_jsonld_article, has_jsonld_author, has_jsonld_date


def _social_share_count(soup):
    """Count likely social share controls and links."""
    social_pattern = re.compile(
        r"share|social|twitter|x\.com|facebook|linkedin|whatsapp|telegram|reddit|pinterest",
        re.I,
    )
    count = 0
    for el in soup.find_all(["a", "button"]):
        attrs = " ".join(
            [
                str(el.get("class", "")),
                str(el.get("id", "")),
                str(el.get("href", "")),
                str(el.get_text(" ", strip=True)),
                str(el.get("aria-label", "")),
            ]
        )
        if social_pattern.search(attrs):
            count += 1
    return count


def _count_lines(text):
    return len([line for line in text.splitlines() if line.strip()])


def extract_features(url):
    """
    Extract feature vector from a URL using generic, domain-agnostic signals.
    Returns None only if page can't be fetched or contains no usable text.

    Feature list:
        0  word_count_log      - log1p(total words in extracted text)
        1  p_count            - Number of <p> tags
        2  avg_p_length       - Avg words per paragraph
        3  a_count            - Number of <a> tags
        4  link_density       - Link word fraction
        5  has_article_tag    - Page has <article> element
        6  text_density       - Text vs total tags ratio
        7  url_length_log      - log1p(URL length)
        8  title_length       - Title word count
        9  has_date           - URL or metadata has date
        10 list_indicator     - % list items detect (lower = more article-like)
        11 metadata_richness  - Has author + date metadata (0-2 scale)
        12 img_density         - Images per paragraph
        13 h1_count            - Number of H1 tags
        14 content_code_ratio  - Visible text chars / HTML chars
        15 social_share_count  - Detected social share links/buttons
        16 has_og_article      - OpenGraph article-type marker
        17 has_twitter_card    - Twitter card metadata exists
        18 has_jsonld          - JSON-LD script exists
        19 has_jsonld_article  - JSON-LD contains Article-like schema
        20 heading_density     - Heading tags per paragraph
        21 sentence_density    - Sentences per 100 words
    """
    if is_non_article_by_rule(url):
        return None

    html = fetch_html(url)
    if not html:
        return None

    raw_html = html
    soup = BeautifulSoup(raw_html, "html.parser")
    
    # Remove noise
    for tag in soup(["script", "style", "nav", "footer", "header",
                     "aside", "noscript", "iframe", "form", "button",
                     "meta", "link"]):
        tag.decompose()

    # Try to extract article content
    article_text = _extract_article_text(soup)
    full_text = soup.get_text(separator=" ", strip=True)

    # If selector hit is too short, fall back to broader page text.
    if not article_text or len(article_text.split()) < 40:
        article_text = full_text

    if not article_text or len(article_text.split()) == 0:
        logger.info("No usable text extracted for URL: %s", url)
        return None
    
    text = article_text
    
    # Core signals
    words = text.split()
    word_count = len(words)
    word_count_log = log1p(word_count)
    
    p_tags = soup.find_all("p")
    p_count = len(p_tags)
    avg_p_length = word_count / max(p_count, 1)
    
    a_tags = soup.find_all("a")
    a_count = len(a_tags)
    link_text = " ".join(a.get_text() for a in a_tags)
    link_density = len(link_text.split()) / max(len(full_text.split()), 1)
    
    # HTML structure
    has_article = 1 if soup.find("article") else 0
    tag_count = len(soup.find_all())
    text_density = len(full_text.split()) / max(tag_count, 1)
    
    # URL signals
    url_length = len(url)
    url_length_log = log1p(url_length)
    has_date = 1 if re.search(r'(20\d{2}|january|february|march|april|may|june|july|august|september|october|november|december)', url.lower()) else 0
    
    # Metadata
    title, author, pub_date = _extract_metadata(soup, url)
    title_length = len(title.split())
    metadata_richness = (1 if author else 0) + (1 if pub_date else 0)
    
    # List indicators (lower = more like article)
    li_count = len(soup.find_all("li"))
    list_indicator = li_count / max(p_count, 1)

    # Missing but useful layout/content signals
    img_count = len(soup.find_all("img"))
    img_density = img_count / max(p_count, 1)
    h1_count = len(soup.find_all("h1"))
    content_code_ratio = len(full_text) / max(len(raw_html), 1)

    social_share_count = _social_share_count(soup)

    og_type = soup.find("meta", property="og:type")
    has_og_article = 1 if og_type and "article" in str(og_type.get("content", "")).lower() else 0

    twitter_card = soup.find("meta", attrs={"name": re.compile(r"twitter:card", re.I)})
    has_twitter_card = 1 if twitter_card else 0

    has_jsonld, has_jsonld_article, has_jsonld_author, has_jsonld_date = _extract_jsonld_flags(soup)

    # Merge metadata signals from classic meta + JSON-LD
    metadata_richness = (
        (1 if author or has_jsonld_author else 0)
        + (1 if pub_date or has_jsonld_date else 0)
    )

    heading_count = len(soup.find_all(["h1", "h2", "h3"]))
    heading_density = heading_count / max(p_count, 1)

    sentence_count = len(re.findall(r"[.!?]+", text))
    sentence_density = (sentence_count * 100.0) / max(word_count, 1)
    
    return [
        word_count_log,
        p_count,
        avg_p_length,
        a_count,
        link_density,
        has_article,
        text_density,
        url_length_log,
        title_length,
        has_date,
        list_indicator,
        metadata_richness,
        img_density,
        h1_count,
        content_code_ratio,
        social_share_count,
        has_og_article,
        has_twitter_card,
        has_jsonld,
        has_jsonld_article,
        heading_density,
        sentence_density,
    ]
