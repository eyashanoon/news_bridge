"""
Article detection for the crawler using the endpoint_discovery page_classifier.

Classification policy (see page_classifier.classification_policy):
  listing_article > 75%  -> listing
  content_article > 90%  -> article
  other           > 65%  -> other
  otherwise WebOrganizer/FormatClassifier backup confirms the type.
"""
from __future__ import annotations

import sys
import threading
from pathlib import Path
from typing import Any

from bs4 import BeautifulSoup

_BACKEND_DIR = Path(__file__).resolve().parents[1]
_DISCOVERY_DIR = _BACKEND_DIR / "endpoint_discovery"
for _path in (_BACKEND_DIR, _DISCOVERY_DIR):
    if str(_path) not in sys.path:
        sys.path.insert(0, str(_path))

from page_classifier.classification_policy import (  # noqa: E402
    CONTENT_THRESHOLD,
    LISTING_THRESHOLD,
    OTHER_THRESHOLD,
    classify_with_policy,
)

_predictor = None
_predictor_lock = threading.Lock()


def _get_predictor():
    global _predictor
    with _predictor_lock:
        if _predictor is None:
            from page_classifier import Predictor

            _predictor = Predictor()
        return _predictor


def _extract_features(soup: BeautifulSoup, url: str) -> dict:
    from listing_discoverer import extract_page_features

    return extract_page_features(soup, url)


def _run_primary(feats: dict, url: str) -> dict:
    return _get_predictor().predict_raw(
        title=feats["title"],
        text=feats["text"],
        url=url,
        meta_tags=feats["meta_tags"],
        headings=feats["headings"],
        dom_stats=feats["dom_stats"],
        url_features=feats["url_features"],
        structural_features=feats["structural_features"],
        num_links=feats["num_links"],
        text_length=feats["text_length"],
        image_count=feats["image_count"],
    )


def classify_page(url: str, html: str | None = None, verbose: bool = False) -> dict[str, Any]:
    """
    Classify a page and return primary + optional backup details.

    Returns dict with label, confidence, is_article, probabilities, backup_used, backup.
    """
    if not html:
        from web_fetch import fetch_html

        page = fetch_html(url, profile="news", timeout=60)
        if not page.ok or not page.html:
            return {
                "is_article": False,
                "label": None,
                "fetch_ok": False,
                "error": page.error or f"HTTP {page.status_code}",
            }
        html = page.html

    soup = BeautifulSoup(html, "lxml")
    feats = _extract_features(soup, url)
    primary = _run_primary(feats, url)
    resolved = classify_with_policy(
        primary,
        url=url,
        title=feats["title"],
        text=feats["text"],
    )

    out = {
        "is_article": resolved["label"] == "content_article",
        "label": resolved["label"],
        "confidence": resolved["confidence"],
        "source": resolved["source"],
        "fetch_ok": True,
        "probabilities": resolved["probabilities"],
        "primary_label": resolved["primary"]["label"],
        "primary_confidence": resolved["primary"]["confidence"],
        "backup_used": resolved["backup_used"],
        "backup": resolved["backup"],
    }

    if verbose:
        _print_verbose(out, url)

    return out


def _print_verbose(out: dict, url: str) -> None:
    if not out.get("fetch_ok"):
        print(f"  [FETCH FAIL] {url}: {out.get('error', '?')}")
        return

    probs = out.get("probabilities") or {}
    print(
        f"  Primary: {out['primary_label']} ({out['primary_confidence']:.1%})  "
        f"probs={probs}"
    )
    print(
        f"  Thresholds: listing>{LISTING_THRESHOLD:.0%}  "
        f"content>{CONTENT_THRESHOLD:.0%}  other>{OTHER_THRESHOLD:.0%}"
    )
    if out.get("backup_used"):
        backup = out.get("backup") or {}
        if backup.get("error"):
            print(f"  Backup: ERROR -- {backup['error']}")
        else:
            print(
                f"  Backup (WebOrganizer): {backup.get('label')} -> "
                f"{backup.get('page_type')} ({backup.get('confidence', 0):.1%})"
            )
    else:
        print(f"  Decision: primary high-confidence ({out.get('source')})")

    label = out.get("label")
    print(f"  Final type: {label} ({out.get('confidence', 0):.1%})")
    print(f"  is_article: {out.get('is_article')}")


def is_article(url: str, html: str | None = None, verbose: bool = False) -> bool:
    """Return True when the resolved page type is content_article."""
    return classify_page(url, html=html, verbose=verbose).get("is_article", False)
