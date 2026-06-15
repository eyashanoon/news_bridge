"""
Numerical feature extraction from stored JSONL record dicts.

Produces a fixed-length float32 numpy vector for every record.
Feature order is STABLE — do not change or reorder existing entries;
append new features only at the end (breaking the order invalidates
all saved checkpoints and scalers).

Feature layout (46 total):
  [0:6]   dom_stats         (6 values)
  [6:15]  url_features      (9 values)
  [15:34] structural        (19 numeric values)
  [34:37] record-level      (3 values)
  [37:44] schema_type       (7 one-hot values)
  [44:46] og_type           (2 one-hot values)
"""

import numpy as np
from config import SCHEMA_TYPES, OG_TYPES

# Exact feature count — referenced by model.py
NUM_FEATURES = 6 + 9 + 19 + 3 + len(SCHEMA_TYPES) + len(OG_TYPES)  # == 46


# ── Helpers ───────────────────────────────────────────────────────────────────

def _f(d: dict, key, default=0.0) -> float:
    """Safely get a float from a dict, returning default if missing/None."""
    v = d.get(key, default)
    return float(v) if v is not None else float(default)


# ── Main feature extractor ────────────────────────────────────────────────────

def extract_numerical_features(record: dict) -> np.ndarray:
    """
    Extract a 46-dimensional float32 vector from a stored page record.

    The record dict is the direct JSON object from dataset.jsonl, containing
    fields: url, label, title, text, links, timestamp, num_links, text_length,
    image_count, headings, meta_tags, dom_stats, url_features,
    structural_features.
    """
    dom  = record.get("dom_stats",           {}) or {}
    urlf = record.get("url_features",        {}) or {}
    strf = record.get("structural_features", {}) or {}

    # ── dom_stats (6) ────────────────────────────────────────────────────────
    f_dom = [
        _f(dom, "total_tags"),
        _f(dom, "p_count"),
        _f(dom, "div_count"),
        _f(dom, "list_items"),
        _f(dom, "tables"),
        _f(dom, "forms"),
    ]

    # ── url_features (9) ─────────────────────────────────────────────────────
    f_url = [
        _f(urlf, "url_depth"),
        _f(urlf, "url_has_date"),
        _f(urlf, "url_has_article_kw"),
        _f(urlf, "url_has_video_kw"),
        _f(urlf, "url_has_audio_kw"),
        _f(urlf, "url_has_listing_kw"),
        _f(urlf, "url_query_count"),
        _f(urlf, "url_length"),
        _f(urlf, "is_root_path"),
    ]

    # ── structural_features — numeric only (19) ───────────────────────────────
    f_str = [
        _f(strf, "article_tag_count"),
        _f(strf, "video_tag_count"),
        _f(strf, "audio_tag_count"),
        _f(strf, "nav_count"),
        _f(strf, "time_tag_count"),
        _f(strf, "figure_count"),
        _f(strf, "blockquote_count"),
        _f(strf, "h1_count"),
        _f(strf, "h2_count"),
        _f(strf, "h3_count"),
        _f(strf, "list_items_with_links"),
        _f(strf, "pagination_present"),
        _f(strf, "has_author"),
        _f(strf, "has_comments"),
        _f(strf, "breadcrumb_count"),
        _f(strf, "avg_link_text_len"),
        _f(strf, "nav_link_ratio"),
        _f(strf, "ad_slot_count"),
        _f(strf, "word_count"),
    ]

    # ── record-level fields (3) ───────────────────────────────────────────────
    f_rec = [
        float(record.get("num_links",    0) or 0),
        float(record.get("text_length",  0) or 0),
        float(record.get("image_count",  0) or 0),
    ]

    # ── schema_type one-hot (7) ───────────────────────────────────────────────
    schema = (strf.get("schema_type") or "").strip()
    schema_oh = [1.0 if schema == s else 0.0 for s in SCHEMA_TYPES]

    # ── og:type one-hot (2) ───────────────────────────────────────────────────
    og = (strf.get("og_type") or "").strip().lower()
    og_oh = [1.0 if og == o else 0.0 for o in OG_TYPES]

    vec = f_dom + f_url + f_str + f_rec + schema_oh + og_oh
    assert len(vec) == NUM_FEATURES, f"Expected {NUM_FEATURES} features, got {len(vec)}"
    return np.array(vec, dtype=np.float32)


# ── Text input builder ────────────────────────────────────────────────────────

def build_text_input(record: dict) -> str:
    """
    Construct the text string fed to XLM-RoBERTa.

    Combines the most semantically discriminative signals:
      1. Page title
      2. Meta description (og:description / twitter:description / name=description)
      3. First few headings (H1, H2) — for listing pages these reveal article titles
      4. First ~400 chars of clean body text

    XLM-RoBERTa handles 100 languages natively, so multilingual content is fine.
    The URL is NOT included in the text; its features are captured numerically
    via url_features (url_has_article_kw, url_has_listing_kw, etc.).
    """
    parts = []

    # 1. Title
    title = (record.get("title") or "").strip()
    if title:
        parts.append(title)

    # 2. Meta description
    meta = record.get("meta_tags") or {}
    desc = (
        meta.get("description") or
        meta.get("og:description") or
        meta.get("twitter:description") or
        ""
    ).strip()
    if desc:
        parts.append(desc)

    # 3. H1 and H2 headings (first 5 total)
    headings = record.get("headings") or []
    h_texts = []
    for h in headings[:8]:
        if not isinstance(h, str):
            continue
        # Stored as "H1: heading text" or "H2: heading text"
        text = h.split(":", 1)[-1].strip() if ":" in h else h.strip()
        level = h.split(":")[0].upper() if ":" in h else ""
        if text and level in ("H1", "H2", "H3"):
            h_texts.append(text)
        if len(h_texts) >= 5:
            break
    if h_texts:
        parts.append(" | ".join(h_texts))

    # 4. Body text snippet
    body = (record.get("text") or "").strip()
    if body:
        parts.append(body[:400])

    return " ".join(parts)
