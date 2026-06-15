"""Thread-safe TTL cache for fetched HTML."""

from __future__ import annotations

import os
import threading
import time
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlparse


def _ttl_seconds() -> float:
    return float(os.environ.get("WEB_FETCH_CACHE_TTL_SECONDS", "300"))


def _max_entries() -> int:
    return int(os.environ.get("WEB_FETCH_CACHE_MAX_ENTRIES", "500"))


def normalize_cache_key(url: str) -> str:
    parsed = urlparse(url.strip())
    path = parsed.path.rstrip("/") or "/"
    return f"{parsed.scheme}://{parsed.netloc.lower()}{path}"


@dataclass
class _CacheEntry:
    html: str
    final_url: str
    status_code: int
    method: str
    expires_at: float


class HtmlCache:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._entries: dict[str, _CacheEntry] = {}

    def get(self, url: str) -> Optional[_CacheEntry]:
        key = normalize_cache_key(url)
        now = time.time()
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None
            if entry.expires_at <= now:
                del self._entries[key]
                return None
            return entry

    def put(
        self,
        url: str,
        *,
        html: str,
        final_url: str,
        status_code: int,
        method: str,
        ttl: Optional[float] = None,
    ) -> None:
        if not html:
            return
        key = normalize_cache_key(url)
        expires = time.time() + (ttl if ttl is not None else _ttl_seconds())
        with self._lock:
            if len(self._entries) >= _max_entries():
                oldest_key = min(self._entries, key=lambda k: self._entries[k].expires_at)
                del self._entries[oldest_key]
            self._entries[key] = _CacheEntry(
                html=html,
                final_url=final_url,
                status_code=status_code,
                method=method,
                expires_at=expires,
            )

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()


HTML_CACHE = HtmlCache()
