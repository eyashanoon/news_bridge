"""Remember which domains work with fast HTTP vs need a browser."""

from __future__ import annotations

import threading
from enum import Enum
from urllib.parse import urlparse


class DomainMode(str, Enum):
    UNKNOWN = "unknown"
    FAST = "fast"          # curl_cffi is enough
    BROWSER = "browser"    # usually needs Playwright


class DomainHintStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._modes: dict[str, DomainMode] = {}
        self._fast_streak: dict[str, int] = {}

    def host(self, url: str) -> str:
        return urlparse(url).netloc.lower()

    def get_mode(self, url: str) -> DomainMode:
        host = self.host(url)
        with self._lock:
            return self._modes.get(host, DomainMode.UNKNOWN)

    def record_success(self, url: str, method: str) -> None:
        host = self.host(url)
        with self._lock:
            if method == "playwright":
                self._modes[host] = DomainMode.BROWSER
                self._fast_streak[host] = 0
                return

            if method in {"curl_cffi", "requests"}:
                streak = self._fast_streak.get(host, 0) + 1
                self._fast_streak[host] = streak
                if streak >= 2:
                    self._modes[host] = DomainMode.FAST

    def record_failure(self, url: str) -> None:
        host = self.host(url)
        with self._lock:
            self._modes[host] = DomainMode.BROWSER
            self._fast_streak[host] = 0

    def skip_browser_probe(self, url: str) -> bool:
        return self.get_mode(url) == DomainMode.FAST

    def prefer_browser(self, url: str) -> bool:
        return self.get_mode(url) == DomainMode.BROWSER


DOMAIN_HINTS = DomainHintStore()
