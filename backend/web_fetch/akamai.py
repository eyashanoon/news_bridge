"""Akamai Bot Manager detection and browser bypass helpers."""

from __future__ import annotations

import re

_AKAMAI_MARKERS = (
    "sec-if-cpt-container",
    "behavioral-content",
    "/epnieg/",
    "errors.edgesuite.net",
)


def looks_like_akamai_challenge(html: str) -> bool:
    lowered = (html or "").lower()
    if not lowered:
        return False
    if any(marker in lowered for marker in _AKAMAI_MARKERS):
        link_count = lowered.count("<a ")
        visible_len = len(re.sub(r"<[^>]+>", " ", lowered).strip())
        if link_count < 8 and visible_len < 6000:
            return True
    if "/epnieg/" in lowered or "qdsf/zqi" in lowered:
        return lowered.count("<a ") < 8
    return False


def looks_like_access_denied(html: str) -> bool:
    lowered = (html or "").lower()
    return "access denied" in lowered and "don't have permission" in lowered
