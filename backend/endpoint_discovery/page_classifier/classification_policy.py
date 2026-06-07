"""
Decision policy for page_classifier + optional WebOrganizer backup.

High-confidence primary thresholds (strictly greater than):
  listing_article  > 75%
  content_article  > 90%
  other            > 65%

If none apply, WebOrganizer/FormatClassifier confirms the page type.
"""
from __future__ import annotations

from typing import Any

LISTING_THRESHOLD = 0.75
CONTENT_THRESHOLD = 0.90
OTHER_THRESHOLD = 0.65

PageType = str  # "content_article" | "listing_article" | "other"


def _prob(probabilities: dict, key: str) -> float:
    return float(probabilities.get(key, 0.0) or 0.0)


def _primary_decision(probabilities: dict) -> PageType | None:
    listing = _prob(probabilities, "listing_article")
    content = _prob(probabilities, "content_article")
    other = _prob(probabilities, "other")

    if listing > LISTING_THRESHOLD:
        return "listing_article"
    if content > CONTENT_THRESHOLD:
        return "content_article"
    if other > OTHER_THRESHOLD:
        return "other"
    return None


def classify_with_policy(
    primary: dict,
    url: str,
    title: str,
    text: str,
) -> dict[str, Any]:
    """
    Resolve final page type from primary model output, using backup when needed.

    Args:
        primary: predict_raw() result (label, confidence, probabilities).
        url, title, text: passed to backup model when required.

    Returns dict with label, confidence, probabilities, source, backup_used, backup.
    """
    probs = primary.get("probabilities") or {}
    decided = _primary_decision(probs)

    if decided is not None:
        return {
            "label": decided,
            "confidence": round(_prob(probs, decided), 4),
            "probabilities": probs,
            "source": "primary",
            "backup_used": False,
            "backup": None,
            "primary": {
                "label": primary.get("label"),
                "confidence": primary.get("confidence"),
                "probabilities": probs,
            },
        }

    backup_used = True
    backup: dict[str, Any] | None = None
    try:
        from .format_classifier_backup import classify_format

        backup = classify_format(url, title, text)
        final_label = backup["page_type"]
        final_conf = float(backup["confidence"])
    except Exception as exc:
        backup = {"error": str(exc)}
        final_label = str(primary.get("label", "other"))
        final_conf = float(primary.get("confidence", 0.0))
        backup_used = False

    return {
        "label": final_label,
        "confidence": round(final_conf, 4),
        "probabilities": probs,
        "source": "backup" if backup_used else "primary_fallback",
        "backup_used": backup_used,
        "backup": backup,
        "primary": {
            "label": primary.get("label"),
            "confidence": primary.get("confidence"),
            "probabilities": probs,
        },
    }
