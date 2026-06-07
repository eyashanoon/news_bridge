"""Heuristics for detecting blocked, empty, or JS-shell pages."""

from __future__ import annotations

import re

from bs4 import BeautifulSoup, Tag

JS_SHELL_HINTS = (
    '<div id="root"></div>',
    "window['fp.prerender']",
    'window["fp.prerender"]',
    "__next",
    'id="app"',
)

BLOCKED_PAGE_HINTS = (
    "access denied",
    "you don't have permission",
    "forbidden",
    "attention required",
    "verify you are human",
    "cf-challenge",
    "captcha",
    "bot detection",
    "temporarily unavailable",
    "errors.edgesuite.net",
    "please enable javascript",
    "checking your browser",
    "just a moment",
    "ddos protection",
    "sec-if-cpt-container",
    "behavioral-content",
    "akamai",
)

CHALLENGE_SCRIPT_HINTS = (
    "sec-if-cpt-container",
    "behavioral-content",
    "cf-challenge",
    "challenge-platform",
    "turnstile",
    "recaptcha",
    "/epnieg/",
)

PAYWALL_HINTS = (
    "subscribe to read",
    "subscription required",
    "sign in to continue",
    "sign in to view",
    "premium content",
    "members only",
    "register to read",
    "register to continue",
    "paywall",
    "subscriber-only",
    "subscribers only",
    "you've reached your limit",
    "create a free account",
)


def text_block_count(soup: BeautifulSoup) -> int:
    count = 0
    for node in soup.find_all(["h1", "h2", "h3", "p", "article"]):
        if not isinstance(node, Tag):
            continue
        text = node.get_text(" ", strip=True)
        if len(text) >= 24:
            count += 1
    return count


def looks_like_challenge_page(html: str) -> bool:
    lowered = (html or "").lower()
    if not lowered:
        return True

    if any(hint in lowered for hint in CHALLENGE_SCRIPT_HINTS):
        link_count = lowered.count("<a ")
        visible_len = len(re.sub(r"<[^>]+>", " ", lowered).strip())
        if link_count < 5 and visible_len < 4000:
            return True

    return False


def looks_like_blocked_page(html: str) -> bool:
    lowered = (html or "").lower()
    if not lowered:
        return True
    if any(hint in lowered[:12000] for hint in BLOCKED_PAGE_HINTS):
        return True
    return looks_like_challenge_page(html)


def looks_like_js_shell(html: str, soup: BeautifulSoup) -> bool:
    lowered = (html or "").lower()
    has_shell_hint = any(hint in lowered for hint in JS_SHELL_HINTS)
    return has_shell_hint and text_block_count(soup) <= 2


def looks_like_corrupted_payload(html: str) -> bool:
    sample = (html or "")[:5000]
    if len(sample) < 400:
        return False

    lowered = sample.lower()
    if "<html" in lowered or "<body" in lowered or "<!doctype" in lowered:
        return False

    replacement_count = sample.count("\ufffd")
    lt_count = sample.count("<")
    gt_count = sample.count(">")
    control_count = sum(1 for ch in sample if ord(ch) < 9 or (13 < ord(ch) < 32))
    weird_count = sum(
        1
        for ch in sample
        if not (ch.isalnum() or ch.isspace() or ch in "<>=/\"'.,;:!?-_|()[]{}")
    )

    mostly_not_html = lt_count < 8 and gt_count < 8
    noisy_text = (
        replacement_count > 20
        or control_count > 20
        or (weird_count / max(1, len(sample)) > 0.25)
    )
    return mostly_not_html and noisy_text


def looks_unusable_html(soup: BeautifulSoup) -> bool:
    has_title = bool(soup.title and (soup.title.string or "").strip())
    has_h1 = bool(soup.find("h1"))
    blocks = text_block_count(soup)

    if not has_title and not has_h1 and blocks <= 1:
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
    if blocks <= 3 and weird_ratio > 0.20:
        return True

    return False


def looks_like_paywall(html: str) -> bool:
    lowered = (html or "").lower()
    if not lowered:
        return False
    if not any(hint in lowered for hint in PAYWALL_HINTS):
        return False

    soup = BeautifulSoup(html, "lxml")
    visible = soup.get_text(" ", strip=True)
    words = len(visible.split())
    return words < 350 or text_block_count(soup) <= 3


def needs_browser_fallback(
    html: str,
    status_code: int,
    *,
    skip_if_fast_domain: bool = False,
) -> bool:
    if skip_if_fast_domain:
        return status_code in {401, 403, 429, 451, 503}
    if status_code in {401, 403, 429, 451, 503}:
        return True
    if not html or not html.strip():
        return True
    if looks_like_blocked_page(html) or looks_like_corrupted_payload(html):
        return True
    if looks_like_challenge_page(html):
        return True

    soup = BeautifulSoup(html, "lxml")
    if looks_unusable_html(soup):
        return True
    if looks_like_js_shell(html, soup):
        return True
    return False
