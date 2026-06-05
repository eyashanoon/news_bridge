"""
PageClassifier neural network architecture.

Design
──────
                                    ┌──────────────────────────────────┐
  Page text (title+meta+headings)   │  XLM-RoBERTa-base (multilingual) │
  ──────────────────────────────►   │  [CLS] pooling → 768-dim          │
                                    └────────────────┬─────────────────┘
                                                     │ text_emb (768)
                                                     ▼
  Structural/URL features (46)      ┌──────────────────────────────────┐
  ──────────────────────────────►   │  FeatureEncoder MLP → 128-dim    │
                                    └────────────────┬─────────────────┘
                                                     │ feat_emb (128)
                                                     ▼
                                    ┌──────────────────────────────────┐
                                    │  Concat (896-dim)                 │
                                    │  → LayerNorm → GELU → Dropout    │
                                    │  → Linear(256) → GELU → Dropout  │
                                    │  → Linear(3)                      │
                                    └──────────────────────────────────┘
                                                     │
                                               3 class logits

Key design choices
──────────────────
- XLM-RoBERTa handles 100 languages without any language-specific tuning.
- The bottom FREEZE_LAYERS transformer layers are frozen: they hold generic
  multilingual representations and don't need to change for this domain.
  Only the top (12 - FREEZE_LAYERS) layers and the head are trained, which
  greatly reduces overfitting risk with ~2000 training samples.
- Structural/URL features go through a separate MLP before fusion so the
  model can learn non-linear combinations of DOM and URL signals.
- Differential learning rates: the encoder gets a small LR to avoid
  catastrophic forgetting; the head gets 10× that LR to converge quickly.
"""

import torch
import torch.nn as nn
from transformers import AutoModel

from config import (
    PRETRAINED_MODEL, TEXT_DIM, FEAT_HIDDEN,
    NUM_LABELS, DROPOUT, FREEZE_LAYERS,
)
from features import NUM_FEATURES


# ── Feature Encoder ───────────────────────────────────────────────────────────

class FeatureEncoder(nn.Module):
    """
    Two-layer MLP that encodes the 46-dimensional scaled feature vector
    into a FEAT_HIDDEN-dimensional representation.
    """

    def __init__(self, input_dim: int = NUM_FEATURES,
                 hidden_dim: int = FEAT_HIDDEN,
                 dropout: float = DROPOUT):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden_dim * 2),
            nn.LayerNorm(hidden_dim * 2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim * 2, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.GELU(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


# ── Main Model ────────────────────────────────────────────────────────────────

class PageClassifier(nn.Module):
    """
    Multimodal page classifier combining:
      - XLM-RoBERTa text encoder (multilingual)
      - Structural/URL feature MLP
      - Fusion classification head
    """

    def __init__(self):
        super().__init__()

        # ── Text encoder (XLM-RoBERTa) ───────────────────────────────────────
        self.encoder = AutoModel.from_pretrained(PRETRAINED_MODEL)
        self._freeze_encoder_layers(FREEZE_LAYERS)

        # ── Structural/URL feature encoder ───────────────────────────────────
        self.feature_encoder = FeatureEncoder()

        # ── Fusion classification head ────────────────────────────────────────
        fusion_dim = TEXT_DIM + FEAT_HIDDEN   # 768 + 128 = 896
        self.classifier = nn.Sequential(
            nn.Dropout(DROPOUT),
            nn.Linear(fusion_dim, FEAT_HIDDEN * 2),   # 896 → 256
            nn.LayerNorm(FEAT_HIDDEN * 2),
            nn.GELU(),
            nn.Dropout(DROPOUT),
            nn.Linear(FEAT_HIDDEN * 2, NUM_LABELS),   # 256 → 3
        )

        # Weight initialisation for the non-pretrained layers
        self._init_weights()

    # ── Initialisation helpers ────────────────────────────────────────────────

    def _freeze_encoder_layers(self, n: int) -> None:
        """
        Freeze the embedding layer and the first `n` transformer blocks.
        Layers [n, 11] remain trainable (XLM-RoBERTa has 12 blocks, 0-indexed).
        """
        # Embeddings
        for p in self.encoder.embeddings.parameters():
            p.requires_grad = False
        # First n transformer blocks
        for layer in self.encoder.encoder.layer[:n]:
            for p in layer.parameters():
                p.requires_grad = False

    def _init_weights(self) -> None:
        """Xavier-uniform initialisation for all Linear layers in the head."""
        for module in [self.feature_encoder, self.classifier]:
            for m in module.modules():
                if isinstance(m, nn.Linear):
                    nn.init.xavier_uniform_(m.weight)
                    if m.bias is not None:
                        nn.init.zeros_(m.bias)

    # ── Forward pass ─────────────────────────────────────────────────────────

    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
        features: torch.Tensor,
    ) -> torch.Tensor:
        """
        Args:
            input_ids:      (B, MAX_SEQ_LEN) — tokenised page text
            attention_mask: (B, MAX_SEQ_LEN) — 1 for real tokens, 0 for padding
            features:       (B, NUM_FEATURES) — scaled structural/URL features
        Returns:
            logits:         (B, NUM_LABELS) — raw (unscaled) class scores
        """
        # Text encoding: take the [CLS] token representation
        enc_out   = self.encoder(input_ids=input_ids, attention_mask=attention_mask)
        text_emb  = enc_out.last_hidden_state[:, 0, :]   # (B, 768)

        # Structural/URL feature encoding
        feat_emb  = self.feature_encoder(features)        # (B, 128)

        # Fuse and classify
        combined  = torch.cat([text_emb, feat_emb], dim=-1)  # (B, 896)
        logits    = self.classifier(combined)                 # (B, 3)
        return logits

    # ── Parameter stats ──────────────────────────────────────────────────────

    def parameter_summary(self) -> dict:
        total     = sum(p.numel() for p in self.parameters())
        trainable = sum(p.numel() for p in self.parameters() if p.requires_grad)
        return {"total": total, "trainable": trainable, "frozen": total - trainable}

    def encoder_param_groups(self, base_lr: float, head_lr_mult: float) -> list:
        """
        Return two parameter groups for AdamW with differential learning rates:
          - encoder params: base_lr
          - feature encoder + classifier params: base_lr * head_lr_mult
        """
        enc_params  = list(self.encoder.parameters())
        head_params = (
            list(self.feature_encoder.parameters()) +
            list(self.classifier.parameters())
        )
        return [
            {"params": enc_params,  "lr": base_lr},
            {"params": head_params, "lr": base_lr * head_lr_mult},
        ]
