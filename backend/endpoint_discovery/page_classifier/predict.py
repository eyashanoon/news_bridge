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

if __name__ == "__main__":
    import json
    from config import DATASET_FILE

    predictor = Predictor()

    # Pick a few sample records from the dataset and classify them
    samples = []
    with open(DATASET_FILE, "r", encoding="utf-8") as fh:
        for line in fh:
            if line.strip():
                samples.append(json.loads(line))
            if len(samples) >= 5:
                break

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
