#!/usr/bin/env python3
"""
Test page classification for a single URL (primary + optional backup).

Usage:
  python test_is_article.py <url>
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
CRAWLER_DIR = Path(__file__).resolve().parent
DISCOVERY_DIR = BACKEND_DIR / "endpoint_discovery"
for p in (BACKEND_DIR, CRAWLER_DIR, DISCOVERY_DIR):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

from page_classifier.classification_policy import (  # noqa: E402
    CONTENT_THRESHOLD,
    LISTING_THRESHOLD,
    OTHER_THRESHOLD,
)
from page_classifier_adapter import classify_page  # noqa: E402


def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python test_is_article.py <url>")
        return 1

    url = sys.argv[1].strip()
    print(f"URL: {url}")
    print(
        f"High-confidence rules: listing>{LISTING_THRESHOLD:.0%}  "
        f"content>{CONTENT_THRESHOLD:.0%}  other>{OTHER_THRESHOLD:.0%}"
    )
    print("Fetching and classifying...\n")

    result = classify_page(url, verbose=True)

    if not result.get("fetch_ok"):
        print(f"\nFailed: {result.get('error', 'unknown error')}")
        return 1

    print("\n-- Summary --")
    print(json.dumps({
        "url": url,
        "label": result["label"],
        "confidence": result["confidence"],
        "is_article": result["is_article"],
        "source": result["source"],
        "primary_label": result["primary_label"],
        "primary_confidence": result["primary_confidence"],
        "probabilities": result["probabilities"],
        "backup_used": result["backup_used"],
        "backup_label": (result.get("backup") or {}).get("label"),
        "backup_page_type": (result.get("backup") or {}).get("page_type"),
    }, indent=2))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
