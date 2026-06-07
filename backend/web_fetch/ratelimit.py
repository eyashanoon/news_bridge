"""Per-domain rate limiting and 429 backoff."""

from __future__ import annotations

import os
import random
import threading
import time
from urllib.parse import urlparse


def _min_delay() -> float:
    return float(os.environ.get("WEB_FETCH_MIN_DELAY", "0.25"))


def _max_retries() -> int:
    return int(os.environ.get("WEB_FETCH_MAX_RETRIES", "3"))


class DomainRateLimiter:
    """Ensures a minimum gap between requests to the same host."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._last_request: dict[str, float] = {}

    def wait(self, url: str) -> None:
        host = urlparse(url).netloc.lower()
        if not host:
            return

        delay = _min_delay()
        with self._lock:
            now = time.time()
            last = self._last_request.get(host, 0.0)
            sleep_for = delay - (now - last)
            if sleep_for > 0:
                time.sleep(sleep_for)
            self._last_request[host] = time.time()


def backoff_sleep(attempt: int, *, status_code: int = 429) -> None:
    """Exponential backoff with jitter for rate-limited responses."""
    base = 1.5 if status_code == 429 else 1.0
    delay = min(30.0, base * (2 ** attempt)) + random.uniform(0.0, 0.5)
    time.sleep(delay)


def should_retry(status_code: int, attempt: int) -> bool:
    if attempt >= _max_retries():
        return False
    return status_code in {429, 503, 502, 408}
