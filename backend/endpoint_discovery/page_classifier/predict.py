"""
Inference module for the Page Classifier.

Usage
─────
  # From a stored record dict (as found in dataset.jsonl):
  from predict import Predictor
  p = Predictor()
  result = p.predict_record(record_dict)

  # From raw page content (title + text + pre-extracted feature dicts):
  result = p.predict_raw(
      title="Breaking: Earthquake hits Turkey",
      text="A 7.2 magnitude earthquake struck ...",
      url="https://example.com/news/2024/earthquake",
      meta_tags={"description": "Live updates ..."},
      headings=["H1: Earthquake Hits Turkey", "H2: Death Toll Rises"],
      dom_stats={"p_count": 12, "total_tags": 340, ...},
      url_features={"url_has_article_kw": 1, "url_has_date": 1, ...},
      structural_features={"has_author": 1, "article_tag_count": 1, ...},
  )

  # Result structure:
  {
      "label":       "content_article",   # top prediction
      "confidence":  0.9741,              # probability of top prediction
      "probabilities": {
          "content_article": 0.9741,
          "listing_article": 0.0193,
          "other":           0.0066,
      }
  }
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import torch
import torch.nn.functional as F
from pathlib import Path
from transformers import AutoTokenizer
from sklearn.preprocessing import StandardScaler

from config import DEVICE, CHECKPOINT_DIR, ID2LABEL, NUM_LABELS, MAX_SEQ_LEN
from features import extract_numerical_features, build_text_input
from model import PageClassifier


class Predictor:
    """
    Loads a trained PageClassifier checkpoint and exposes a simple predict API.

    The checkpoint is self-contained: it embeds scaler statistics so no
    separate scaler file is required (though scaler.pkl is also saved by
    train.py as a convenience).
    """

    def __init__(self, checkpoint_dir: str | Path = CHECKPOINT_DIR):
        checkpoint_dir = Path(checkpoint_dir)
        ckpt_path      = checkpoint_dir / "best_model.pt"
        tok_path       = checkpoint_dir / "tokenizer"

        if not ckpt_path.exists():
            raise FileNotFoundError(
                f"No trained model found at {ckpt_path}\n"
                "Run  python train.py  first."
            )

        print(f"Loading model from {ckpt_path} ...")
        ckpt = torch.load(ckpt_path, map_location=DEVICE)

        # Tokenizer
        self.tokenizer = AutoTokenizer.from_pretrained(str(tok_path))

        # Model
        self.model = PageClassifier().to(DEVICE)
        self.model.load_state_dict(ckpt["model_state"])
        self.model.eval()

        # Scaler (embedded in checkpoint)
        self._scaler       = StandardScaler()
        self._scaler.mean_ = np.array(ckpt["scaler_mean"])
        self._scaler.scale_ = np.array(ckpt["scaler_scale"])
        self._scaler.n_features_in_ = len(self._scaler.mean_)

        print(f"Model ready (checkpoint epoch {ckpt['epoch']}, "
              f"val macro-F1 = {ckpt['val_f1']:.4f})")

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _encode(self, record: dict) -> dict:
        """Tokenise text and scale numerical features from a record dict."""
        text = build_text_input(record)
        enc  = self.tokenizer(
            text,
            max_length=MAX_SEQ_LEN,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        )
        raw_feat = extract_numerical_features(record).reshape(1, -1)
        feat     = self._scaler.transform(raw_feat).flatten().astype(np.float32)
        return {
            "input_ids":      enc["input_ids"].to(DEVICE),
            "attention_mask": enc["attention_mask"].to(DEVICE),
            "features":       torch.tensor(feat, dtype=torch.float32).unsqueeze(0).to(DEVICE),
        }

    def _logits_to_result(self, logits: torch.Tensor) -> dict:
        probs = F.softmax(logits, dim=-1).squeeze(0)
        pred  = probs.argmax().item()
        return {
            "label":       ID2LABEL[pred],
            "confidence":  round(float(probs[pred]), 4),
            "probabilities": {
                ID2LABEL[i]: round(float(probs[i]), 4)
                for i in range(NUM_LABELS)
            },
        }

    # ── Public API ────────────────────────────────────────────────────────────

    def predict_record(self, record: dict) -> dict:
        """
        Classify a page from a stored record dict (same format as dataset.jsonl).
        The 'html' field is ignored; all signals come from pre-extracted fields.
        """
        inputs = self._encode(record)
        with torch.no_grad():
            logits = self.model(
                inputs["input_ids"],
                inputs["attention_mask"],
                inputs["features"],
            )
        return self._logits_to_result(logits)

    def predict_raw(
        self,
        title:               str  = "",
        text:                str  = "",
        url:                 str  = "",
        meta_tags:           dict | None = None,
        headings:            list | None = None,
        dom_stats:           dict | None = None,
        url_features:        dict | None = None,
        structural_features: dict | None = None,
        num_links:           int  = 0,
        text_length:         int  = 0,
        image_count:         int  = 0,
    ) -> dict:
        """
        Classify a page from raw extracted components.
        Only provide the fields you have; missing ones default to zero/empty.

        Typical usage: pass the output of app.utils.extractor.extract_features()
        plus the page title and URL.
        """
        record = {
            "url":                 url,
            "title":               title,
            "text":                text,
            "meta_tags":           meta_tags           or {},
            "headings":            headings            or [],
            "dom_stats":           dom_stats           or {},
            "url_features":        url_features        or {},
            "structural_features": structural_features or {},
            "num_links":           num_links,
            "text_length":         text_length,
            "image_count":         image_count,
        }
        return self.predict_record(record)

    def predict_batch(self, records: list) -> list:
        """
        Classify a list of record dicts.
        Returns a list of result dicts in the same order.
        """
        from torch.utils.data import DataLoader
        from dataset import PageDataset
        from config import LABEL2ID

        ds     = PageDataset(records, self.tokenizer, self._scaler, LABEL2ID)
        loader = DataLoader(ds, batch_size=32, shuffle=False, num_workers=0)

        all_results = []
        with torch.no_grad():
            for batch in loader:
                ids   = batch["input_ids"].to(DEVICE)
                mask  = batch["attention_mask"].to(DEVICE)
                feats = batch["features"].to(DEVICE)
                logits = self.model(ids, mask, feats)
                probs  = F.softmax(logits, dim=-1).cpu()
                for row in probs:
                    pred = row.argmax().item()
                    all_results.append({
                        "label":       ID2LABEL[pred],
                        "confidence":  round(float(row[pred]), 4),
                        "probabilities": {
                            ID2LABEL[i]: round(float(row[i]), 4)
                            for i in range(NUM_LABELS)
                        },
                    })
        return all_results


# ── CLI demo ──────────────────────────────────────────────────────────────────

_DEMO_SAMPLES = [
    {
        "label": "content_article",
        "url": "https://example.com/news/2024/03/15/earthquake-hits-turkey",
        "title": "7.2 Magnitude Earthquake Strikes Eastern Turkey",
        "text": (
            "A powerful earthquake struck eastern Turkey early Monday, "
            "causing widespread damage across several provinces. "
            "Rescue teams have been deployed to search for survivors."
        ),
        "meta_tags": {"description": "Live updates on the earthquake in Turkey"},
        "headings": ["H1: Earthquake Hits Turkey", "H2: Death Toll Rises"],
        "num_links": 18,
        "text_length": 4200,
        "image_count": 3,
        "dom_stats": {"total_tags": 340, "p_count": 12, "div_count": 45,
                      "list_items": 8, "tables": 0, "forms": 1},
        "url_features": {"url_depth": 5, "url_has_date": 1, "url_has_article_kw": 1,
                           "url_has_video_kw": 0, "url_has_audio_kw": 0,
                           "url_has_listing_kw": 0, "url_query_count": 0,
                           "url_length": 62, "is_root_path": 0},
        "structural_features": {"article_tag_count": 1, "video_tag_count": 0,
                                "audio_tag_count": 0, "nav_count": 1,
                                "time_tag_count": 1, "figure_count": 2,
                                "blockquote_count": 1, "h1_count": 1, "h2_count": 3,
                                "h3_count": 2, "list_items_with_links": 4,
                                "pagination_present": 0, "has_author": 1,
                                "has_comments": 1, "breadcrumb_count": 1,
                                "avg_link_text_len": 22.0, "nav_link_ratio": 0.15,
                                "ad_slot_count": 2, "word_count": 680,
                                "schema_type": "NewsArticle", "og_type": "article"},
    },
    {
        "label": "listing_article",
        "url": "https://example.com/world/news",
        "title": "World News - Latest Headlines",
        "text": "Browse the latest world news stories from our correspondents.",
        "meta_tags": {"description": "Latest world news headlines and breaking stories"},
        "headings": [
            "H1: World News",
            "H2: Earthquake Hits Turkey",
            "H2: EU Summit Concludes",
            "H2: Markets Rally on Jobs Data",
        ],
        "num_links": 85,
        "text_length": 900,
        "image_count": 12,
        "dom_stats": {"total_tags": 520, "p_count": 4, "div_count": 90,
                      "list_items": 40, "tables": 0, "forms": 1},
        "url_features": {"url_depth": 2, "url_has_date": 0, "url_has_article_kw": 0,
                           "url_has_video_kw": 0, "url_has_audio_kw": 0,
                           "url_has_listing_kw": 1, "url_query_count": 0,
                           "url_length": 32, "is_root_path": 0},
        "structural_features": {"article_tag_count": 0, "video_tag_count": 0,
                                "audio_tag_count": 0, "nav_count": 2,
                                "time_tag_count": 0, "figure_count": 12,
                                "blockquote_count": 0, "h1_count": 1, "h2_count": 15,
                                "h3_count": 0, "list_items_with_links": 35,
                                "pagination_present": 1, "has_author": 0,
                                "has_comments": 0, "breadcrumb_count": 1,
                                "avg_link_text_len": 38.0, "nav_link_ratio": 0.25,
                                "ad_slot_count": 4, "word_count": 120,
                                "schema_type": "CollectionPage", "og_type": "website"},
    },
    {
        "label": "other",
        "url": "https://example.com/",
        "title": "Example News - Home",
        "text": "Welcome to Example News. Watch live, browse sections, and subscribe.",
        "meta_tags": {"description": "Your trusted source for breaking news"},
        "headings": ["H1: Example News", "H2: Trending Now", "H2: Video Highlights"],
        "num_links": 120,
        "text_length": 600,
        "image_count": 8,
        "dom_stats": {"total_tags": 680, "p_count": 6, "div_count": 110,
                      "list_items": 25, "tables": 0, "forms": 2},
        "url_features": {"url_depth": 0, "url_has_date": 0, "url_has_article_kw": 0,
                           "url_has_video_kw": 1, "url_has_audio_kw": 0,
                           "url_has_listing_kw": 0, "url_query_count": 0,
                           "url_length": 22, "is_root_path": 1},
        "structural_features": {"article_tag_count": 0, "video_tag_count": 3,
                                "audio_tag_count": 0, "nav_count": 3,
                                "time_tag_count": 0, "figure_count": 5,
                                "blockquote_count": 0, "h1_count": 1, "h2_count": 4,
                                "h3_count": 6, "list_items_with_links": 18,
                                "pagination_present": 0, "has_author": 0,
                                "has_comments": 0, "breadcrumb_count": 0,
                                "avg_link_text_len": 14.0, "nav_link_ratio": 0.55,
                                "ad_slot_count": 6, "word_count": 90,
                                "schema_type": "WebPage", "og_type": "website"},
    },
]


def _load_cli_samples(dataset_file: Path, limit: int = 5) -> list[dict]:
    """Load records from dataset.jsonl, or fall back to built-in demos."""
    import json

    if dataset_file.is_file():
        samples = []
        with open(dataset_file, "r", encoding="utf-8") as fh:
            for line in fh:
                if line.strip():
                    samples.append(json.loads(line))
                if len(samples) >= limit:
                    break
        return samples

    print(
        f"Note: {dataset_file} not found — using built-in demo samples.\n"
        f"      Pass a JSONL path as the first argument to classify your own records."
    )
    return _DEMO_SAMPLES[:limit]


if __name__ == "__main__":
    from config import DATASET_FILE

    dataset_arg = Path(sys.argv[1]) if len(sys.argv) > 1 else DATASET_FILE
    predictor = Predictor()
    samples = _load_cli_samples(dataset_arg)

    print("\n── Sample predictions ─────────────────────────────────────")
    for rec in samples:
        result = predictor.predict_record(rec)
        true_label = rec.get("label", "?")
        match = "✅" if result["label"] == true_label else "❌"
        print(
            f"{match} True: {true_label:<20}"
            f" Predicted: {result['label']:<20}"
            f" Confidence: {result['confidence']:.4f}"
        )
        print(f"   URL: {rec.get('url', '')[:80]}")
    print()
