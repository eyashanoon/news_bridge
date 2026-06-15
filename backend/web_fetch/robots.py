"""robots.txt checking with cached parsers."""

from __future__ import annotations

import logging
import os
import threading
import time
from typing import Optional
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

logger = logging.getLogger(__name__)

_UA = "NewsBridgeCrawler/1.0"
_CACHE_TTL = float(os.environ.get("WEB_FETCH_ROBOTS_CACHE_TTL", "3600"))


def _enabled() -> bool:
    return os.environ.get("WEB_FETCH_RESPECT_ROBOTS", "true").lower() not in {
        "0",
        "false",
        "no",
    }


class RobotsCache:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._parsers: dict[str, tuple[RobotFileParser, float]] = {}

    def allowed(self, url: str) -> bool:
        if not _enabled():
            return True

        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            return True

        host = parsed.netloc.lower()
        parser = self._get_parser(host, parsed.scheme)
        if parser is None:
            return True

        try:
            return parser.can_fetch(_UA, url)
        except Exception:
            return True

    def _get_parser(self, host: str, scheme: str) -> Optional[RobotFileParser]:
        now = time.time()
        with self._lock:
            cached = self._parsers.get(host)
            if cached and cached[1] > now:
                return cached[0]

        robots_url = f"{scheme}://{host}/robots.txt"
        parser = RobotFileParser()
        parser.set_url(robots_url)

        try:
            from curl_cffi import requests as curl_requests

            resp = curl_requests.get(
                robots_url,
                impersonate=os.environ.get("WEB_FETCH_IMPERSONATE", "chrome120"),
                timeout=8,
            )
            if resp.status_code >= 400:
                parser = None
            else:
                parser.parse(resp.text.splitlines())
        except Exception as exc:
            logger.debug("robots.txt fetch failed for %s: %s", host, exc)
            parser = None

        with self._lock:
            self._parsers[host] = (parser, now + _CACHE_TTL)
        return parser


ROBOTS = RobotsCache()
