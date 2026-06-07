"""
Backup page-type confirmation using WebOrganizer/FormatClassifier.

Used when primary page_classifier probabilities do not meet high-confidence
thresholds. https://huggingface.co/WebOrganizer/FormatClassifier
"""
from __future__ import annotations

import threading
from typing import Any

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

MODEL_ID = "WebOrganizer/FormatClassifier"

_LISTING_LABELS = frozenset({
    "Content Listing",
    "Listicle",
})

_ARTICLE_LABELS = frozenset({
    "News Article",
    "Nonfiction Writing",
})

_tokenizer = None
_model = None
_lock = threading.Lock()


def _fix_position_ids(model) -> None:
    """Re-init position_ids buffers broken under transformers 5.x + custom gte code."""
    max_pos = model.config.max_position_embeddings
    ids = torch.arange(max_pos, dtype=torch.long)
    for module in model.modules():
        if hasattr(module, "position_ids"):
            module.register_buffer("position_ids", ids.clone(), persistent=False)


def _get_model():
    global _tokenizer, _model
    with _lock:
        if _model is None:
            _tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
            _model = AutoModelForSequenceClassification.from_pretrained(
                MODEL_ID,
                trust_remote_code=True,
                use_memory_efficient_attention=False,
            )
            _fix_position_ids(_model)
            _model.eval()
        return _tokenizer, _model


def _build_input(url: str, title: str, text: str, max_chars: int = 6000) -> str:
    body = text.strip()
    if title.strip():
        body = f"{title.strip()}\n\n{body}" if body else title.strip()
    return f"{url}\n\n{body}".strip()[:max_chars]


def _map_format_label(format_label: str) -> str:
    if format_label in _LISTING_LABELS:
        return "listing_article"
    if format_label in _ARTICLE_LABELS:
        return "content_article"
    return "other"


def classify_format(url: str, title: str, text: str) -> dict[str, Any]:
    """
    Run WebOrganizer/FormatClassifier on URL + page text.

    Returns label (WebOrganizer class), page_type (our 3-class label),
    confidence, and top probabilities.
    """
    tokenizer, model = _get_model()
    web_page = _build_input(url, title, text)

    with torch.no_grad():
        inputs = tokenizer([web_page], return_tensors="pt", truncation=True, max_length=512)
        logits = model(**inputs).logits
        probs = torch.softmax(logits, dim=-1).squeeze(0)

    id2label = model.config.id2label
    prob_map = {id2label[i]: float(probs[i]) for i in range(len(probs))}
    top_id = int(probs.argmax())
    top_label = id2label[top_id]
    top_conf = float(probs[top_id])

    return {
        "label": top_label,
        "page_type": _map_format_label(top_label),
        "confidence": round(top_conf, 4),
        "probabilities": {k: round(v, 4) for k, v in sorted(
            prob_map.items(), key=lambda kv: kv[1], reverse=True
        )[:8]},
    }
