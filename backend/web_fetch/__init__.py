"""Shared anti-bot HTML fetch layer for discovery, crawling, and extraction."""

import web_fetch.asyncio_policy  # noqa: F401

from web_fetch.cache import HTML_CACHE, normalize_cache_key
from web_fetch.detection import looks_like_paywall
from web_fetch.fetch import FetchResult, fetch_html, fetch_soup

__all__ = [
    "FetchResult",
    "HTML_CACHE",
    "fetch_html",
    "fetch_soup",
    "looks_like_paywall",
    "normalize_cache_key",
]
