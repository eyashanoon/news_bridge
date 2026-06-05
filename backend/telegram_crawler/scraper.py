from __future__ import annotations

import logging
import re
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger("telegram_crawler")

# Telegram system usernames that are not real channels
_SKIP_USERNAMES = frozenset({
    "s", "proxy", "socks", "addstickers", "joinchat", "addtheme",
    "share", "login", "setlanguage", "addlist", "boost", "iv", "a",
    "dl", "confirmphone", "passport", "bg",
})

_UA_BROWSER = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

_HEADERS_BROWSER = {
    "User-Agent": _UA_BROWSER,
    "Accept-Language": "en-US,en;q=0.9",
}

_HEADERS_BOT = {
    "User-Agent": "TelegramBot (like TwitterBot)",
    "Accept-Language": "en-US,en;q=0.9",
}


def _is_arabic(text: str) -> bool:
    """Return True when the query contains a meaningful amount of Arabic script."""
    arabic = sum(1 for ch in text if "\u0600" <= ch <= "\u06FF")
    return arabic >= 2


def _make_search_headers(arabic: bool = False) -> dict[str, str]:
    """Browser-like headers with language preference tuned to the query script."""
    lang = "ar,en-US;q=0.8,en;q=0.6" if arabic else "en-US,en;q=0.9,ar;q=0.5"
    return {"User-Agent": _UA_BROWSER, "Accept-Language": lang}


# ── Public API ──────────────────────────────────────────────────────────────


def search_channels(query: str, timeout: int = 15) -> list[dict[str, Any]]:
    """Search for Telegram channels matching a query.

    Uses a two-phase approach:
      1. Discover candidate usernames via web search + direct probe.
      2. Validate each candidate against t.me to extract real metadata.

    Supports partial names, multi-language queries, and fuzzy matching.
    """
    raw = query.strip()
    if not raw:
        return []

    # Phase 1 — gather candidate usernames from multiple sources
    candidates: list[str] = []
    seen: set[str] = set()

    def _add(usernames: list[str]) -> None:
        for u in usernames:
            low = u.lower()
            if low not in seen and low not in _SKIP_USERNAMES and len(u) >= 4:
                seen.add(low)
                candidates.append(u)

    # Source A: direct t.me probe — only when the query itself looks like a username.
    exact_candidate = _extract_username_candidate(raw)
    if exact_candidate:
        _add([exact_candidate])

    # Source B: web search (finds channels by name/topic in all languages)
    _add(_web_search_candidates(raw, timeout))

    # Phase 2 — validate each candidate and build rich results
    query_norm = _normalize_for_match(raw)
    query_tokens = [t for t in query_norm.split() if t]

    results: list[dict[str, Any]] = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {
            pool.submit(_validate_channel, u, timeout): u
            for u in candidates[:30]
        }
        for future in as_completed(futures):
            info = future.result()
            if info:
                score = _score_result(info, query_norm, query_tokens, exact_candidate)
                # Keep only reasonably relevant results for non-exact searches.
                if exact_candidate or score >= 8:
                    info["_score"] = score
                    results.append(info)

    results.sort(
        key=lambda r: (
            r.get("_score", 0),
            int(r.get("subscribers") or 0),
        ),
        reverse=True,
    )

    for r in results:
        r.pop("_score", None)

    return results[:10]


def _extract_username_candidate(raw: str) -> Optional[str]:
    s = raw.strip()
    if not s:
        return None
    s = s.replace("https://t.me/", "").replace("http://t.me/", "").replace("t.me/", "")
    s = s.lstrip("@").strip()
    if re.fullmatch(r"[a-zA-Z_][\w]{3,31}", s):
        return s
    return None


def _normalize_for_match(text: str) -> str:
    s = (text or "").strip().lower()
    if not s:
        return ""

    # Normalize Unicode form and strip diacritics/marks.
    s = unicodedata.normalize("NFKD", s)
    s = "".join(ch for ch in s if not unicodedata.combining(ch))

    # Arabic letter normalization helps queries with/without hamza variants.
    s = s.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا")
    s = s.replace("ى", "ي")
    s = s.replace("ؤ", "و").replace("ئ", "ي")
    s = s.replace("ـ", "")

    s = re.sub(r"[^\w\u0600-\u06FF\s]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _score_result(
    info: dict[str, Any],
    query_norm: str,
    query_tokens: list[str],
    exact_candidate: Optional[str],
) -> int:
    username = (info.get("username") or "")
    title = (info.get("title") or "")
    description = (info.get("description") or "")

    username_l = username.lower()
    username_n = _normalize_for_match(username)
    title_n = _normalize_for_match(title)
    desc_n = _normalize_for_match(description)
    blob = f"{username_n} {title_n} {desc_n}".strip()

    score = 0
    if exact_candidate and username_l == exact_candidate.lower():
        score += 200
    if query_norm:
        if username_n == query_norm:
            score += 140
        if title_n == query_norm:
            score += 120
        if username_n.startswith(query_norm):
            score += 70
        if query_norm in username_n:
            score += 50
        if query_norm in title_n:
            score += 45
        if query_norm in desc_n:
            score += 25

    token_hits = 0
    for t in query_tokens:
        if t in blob:
            token_hits += 1

    score += token_hits * 12
    if query_tokens and token_hits == len(query_tokens):
        score += 40
    if query_tokens and token_hits == 0:
        score -= 25

    return score


# ── Web search helpers ──────────────────────────────────────────────────────


def _web_search_candidates(query: str, timeout: int) -> list[str]:
    """Search multiple web sources for Telegram channel usernames matching *query*.

    All strategies run unconditionally so that no source is skipped because
    another happened to return a few low-quality results.  Arabic queries get
    an Arabic Accept-Language header so search engines return Arabic-language
    t.me results instead of filtering them out.
    """
    arabic = _is_arabic(query)
    hdrs = _make_search_headers(arabic)
    usernames: list[str] = []

    # Strategy 1: DuckDuckGo HTML — no JS, reliable, Arabic-friendly
    try:
        resp = requests.get(
            "https://html.duckduckgo.com/html/",
            params={"q": f"site:t.me {query}"},
            headers=hdrs,
            timeout=timeout,
        )
        if resp.status_code == 200:
            usernames.extend(_extract_usernames(resp.text))
    except Exception as ex:
        logger.debug(f"DuckDuckGo search failed: {ex}")

    # Strategy 2: Startpage — proxies Google results, no JS required
    try:
        resp = requests.post(
            "https://www.startpage.com/do/search",
            data={"query": f"site:t.me {query}", "cat": "web"},
            headers=hdrs,
            timeout=timeout,
        )
        if resp.status_code == 200:
            usernames.extend(_extract_usernames(resp.text))
    except Exception as ex:
        logger.debug(f"Startpage search failed: {ex}")

    # Strategy 3: Bing — extract from <cite> elements and raw HTML
    try:
        bing_params: dict[str, Any] = {"q": f"site:t.me {query}", "count": 20}
        if arabic:
            bing_params["setlang"] = "ar"
            bing_params["cc"] = "AE"
        resp = requests.get(
            "https://www.bing.com/search",
            params=bing_params,
            headers=hdrs,
            timeout=timeout,
        )
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, "html.parser")
            for cite in soup.find_all("cite"):
                cite_text = cite.get_text(strip=True)
                for m in re.finditer(r't\.me/([a-zA-Z_]\w{3,31})', cite_text):
                    usernames.append(m.group(1))
            usernames.extend(_extract_usernames(resp.text))
    except Exception as ex:
        logger.debug(f"Bing search failed: {ex}")

    # Strategy 4: Broad search without site: restriction — vital for Arabic/non-Latin
    # where site:t.me may yield nothing even though the channel exists
    try:
        resp = requests.post(
            "https://www.startpage.com/do/search",
            data={"query": f'telegram channel "{query}"', "cat": "web"},
            headers=hdrs,
            timeout=timeout,
        )
        if resp.status_code == 200:
            usernames.extend(_extract_usernames(resp.text))
    except Exception as ex:
        logger.debug(f"Startpage broad search failed: {ex}")

    # Strategy 5: DuckDuckGo broad — extra pass for Arabic / non-Latin queries
    if arabic:
        try:
            resp = requests.get(
                "https://html.duckduckgo.com/html/",
                params={"q": f"telegram {query}"},
                headers=hdrs,
                timeout=timeout,
            )
            if resp.status_code == 200:
                usernames.extend(_extract_usernames(resp.text))
        except Exception as ex:
            logger.debug(f"DuckDuckGo broad search failed: {ex}")

    # De-duplicate preserving order
    seen: set[str] = set()
    deduped: list[str] = []
    for u in usernames:
        low = u.lower()
        if low not in seen:
            seen.add(low)
            deduped.append(u)
    return deduped


def _extract_usernames(html: str) -> list[str]:
    """Extract plausible Telegram usernames from raw HTML text."""
    found: list[str] = []
    for m in re.finditer(r't\.me/([a-zA-Z_]\w{3,31})', html):
        u = m.group(1)
        if u.lower() not in _SKIP_USERNAMES:
            found.append(u)
    return found


def _validate_channel(username: str, timeout: int) -> Optional[dict[str, Any]]:
    """Validate a username against t.me and extract channel metadata.

    Returns a dict with channel info, or None if it's not a real channel.
    """
    try:
        resp = requests.get(
            f"https://t.me/{username}", headers=_HEADERS_BOT, timeout=timeout
        )
        if resp.status_code != 200:
            return None

        soup = BeautifulSoup(resp.text, "html.parser")

        # A real channel/group has a .tgme_page_title element.
        page_title_el = soup.select_one(".tgme_page_title")
        if not page_title_el:
            return None

        display_name = page_title_el.get_text(strip=True)

        # Description
        desc_el = soup.select_one(".tgme_page_description")
        description = desc_el.get_text(strip=True) if desc_el else ""

        # Subscriber / member count
        subscribers = None
        extra_el = soup.select_one(".tgme_page_extra")
        if extra_el:
            extra_text = extra_el.get_text(strip=True).replace("\xa0", " ")
            num_match = re.match(r"([\d\s]+)", extra_text)
            if num_match:
                try:
                    subscribers = int(num_match.group(1).replace(" ", ""))
                except ValueError:
                    pass

        # Avatar image (skip generic Telegram logo)
        og_img_el = soup.find("meta", attrs={"property": "og:image"})
        avatar_url = og_img_el["content"] if og_img_el else None
        if avatar_url and "t_logo" in avatar_url:
            avatar_url = None

        # Check for public message preview
        has_preview = _check_public_preview(username, timeout)

        return {
            "username": username,
            "title": display_name or username,
            "description": description,
            "avatarUrl": avatar_url,
            "subscribers": subscribers,
            "hasPublicPreview": has_preview,
        }
    except Exception as ex:
        logger.debug(f"Channel validation for '{username}' failed: {ex}")
        return None


def _check_public_preview(username: str, timeout: int) -> bool:
    """Quick check whether t.me/s/{username} has a public message history."""
    try:
        resp = requests.get(
            f"https://t.me/s/{username}", headers=_HEADERS_BOT, timeout=timeout
        )
        if resp.status_code != 200:
            return False
        soup = BeautifulSoup(resp.text, "html.parser")
        return soup.select_one(".tgme_channel_history") is not None
    except Exception:
        return False


def scrape_channel(
    channel_username: str,
    max_posts: int = 50,
    timeout: int = 30,
    since: Optional[datetime] = None,
) -> list[dict[str, Any]]:
    """Scrape recent posts from a public Telegram channel via t.me/s/ web preview.
    If `since` is provided, only return posts newer than that datetime."""
    url = f"https://t.me/s/{channel_username}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }

    try:
        resp = requests.get(url, headers=headers, timeout=timeout)
        resp.raise_for_status()
    except Exception as ex:
        logger.error(f"Failed to fetch channel @{channel_username}: {ex}")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    message_divs = soup.select(".tgme_widget_message_wrap")

    posts: list[dict[str, Any]] = []

    for div in message_divs[-max_posts:]:
        try:
            msg_widget = div.select_one(".tgme_widget_message")
            if not msg_widget:
                continue

            data_post = msg_widget.get("data-post", "")
            parts = data_post.split("/")
            if len(parts) < 2:
                continue
            try:
                msg_id = int(parts[-1])
            except ValueError:
                continue

            # Content text
            text_el = msg_widget.select_one(".tgme_widget_message_text")
            content = text_el.get_text(separator="\n", strip=True) if text_el else ""

            # Media
            media_url = None
            media_type = None

            photo_el = msg_widget.select_one(".tgme_widget_message_photo_wrap")
            if photo_el:
                style = photo_el.get("style", "")
                m = re.search(r"url\(['\"]?(.*?)['\"]?\)", style)
                if m:
                    media_url = m.group(1)
                    media_type = "photo"

            video_el = msg_widget.select_one("video")
            if video_el:
                media_url = video_el.get("src")
                media_type = "video"

            # Date
            date_el = msg_widget.select_one("time[datetime]")
            msg_date = None
            msg_dt = None
            if date_el:
                try:
                    msg_dt = datetime.fromisoformat(
                        date_el["datetime"].replace("Z", "+00:00")
                    ).astimezone(timezone.utc)
                    msg_date = msg_dt.isoformat()
                except Exception:
                    pass

            # Skip posts older than the `since` cutoff
            if since and msg_dt and msg_dt <= since:
                continue

            # Views
            views_el = msg_widget.select_one(".tgme_widget_message_views")
            view_count = 0
            if views_el:
                raw = views_el.get_text(strip=True).upper().replace(",", "")
                try:
                    if raw.endswith("K"):
                        view_count = int(float(raw[:-1]) * 1000)
                    elif raw.endswith("M"):
                        view_count = int(float(raw[:-1]) * 1000000)
                    else:
                        view_count = int(raw)
                except ValueError:
                    pass

            posts.append({
                "telegramMessageId": msg_id,
                "content": content,
                "mediaUrl": media_url,
                "mediaType": media_type,
                "messageDate": msg_date,
                "viewCount": view_count,
                "edited": False,
            })

        except Exception as ex:
            logger.warning(f"Error parsing message in @{channel_username}: {ex}")
            continue

    logger.info(f"Scraped {len(posts)} posts from @{channel_username}")
    return posts
