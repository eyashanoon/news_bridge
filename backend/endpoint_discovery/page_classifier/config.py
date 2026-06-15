"""
All hyperparameters, paths, and constants for the Page Classifier.
"""
import logging
import os
from pathlib import Path

import torch

logger = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────
# ROOT = listingdiscovery/ (two levels up from this file)
ROOT           = Path(__file__).resolve().parent.parent
DATA_DIR       = ROOT / "data" / "labeled"
DATASET_FILE   = DATA_DIR / "dataset.jsonl"
CHECKPOINT_DIR = Path(__file__).resolve().parent / "checkpoints"
CHECKPOINT_DIR.mkdir(exist_ok=True)

# ── Labels ────────────────────────────────────────────────────────────────────
LABEL2ID = {
    "content_article": 0,   # Full article page
    "listing_article": 1,   # Page listing/indexing articles
    "other":           2,   # Anything else (home, video, category, etc.)
}
ID2LABEL   = {v: k for k, v in LABEL2ID.items()}
NUM_LABELS = len(LABEL2ID)

# ── Pretrained model ──────────────────────────────────────────────────────────
# xlm-roberta-base: 100-language multilingual model (Facebook/Meta)
# Handles Arabic, Chinese, Japanese, French, Spanish, German, Russian, etc.
# Will be auto-downloaded from HuggingFace Hub (~280 MB, internet required first run)
PRETRAINED_MODEL = "xlm-roberta-base"
MAX_SEQ_LEN      = 256     # tokens fed to the transformer (title + meta + headings + snippet)

# Freeze the bottom N of 12 transformer layers.
# Keeps multilingual knowledge intact; only the upper layers + head are fine-tuned.
FREEZE_LAYERS = 8

# ── Feature encoding ──────────────────────────────────────────────────────────
# Categorical features that are one-hot encoded into the feature vector.
# Keep these lists stable — changing order breaks loaded checkpoints.
SCHEMA_TYPES = [
    "Article", "NewsArticle", "BlogPosting",
    "ItemList", "WebPage", "BreadcrumbList", "CollectionPage",
]
OG_TYPES = ["article", "website"]

# ── Hardware ─────────────────────────────────────────────────────────────────
# PAGE_CLASSIFIER_DEVICE: auto (default) | cpu | cuda | cuda:0
# PAGE_CLASSIFIER_MIN_CUDA_FREE_MB: min free VRAM for auto mode (default 1200)
_MIN_CUDA_FREE_BYTES = (
    int(os.environ.get("PAGE_CLASSIFIER_MIN_CUDA_FREE_MB", "1200")) * 1024 * 1024
)


def resolve_device() -> torch.device:
    """Pick inference device; fall back to CPU when VRAM is too tight."""
    override = os.environ.get("PAGE_CLASSIFIER_DEVICE", "auto").strip().lower()
    if override == "cpu":
        return torch.device("cpu")
    if override.startswith("cuda"):
        return torch.device(override)

    if not torch.cuda.is_available():
        return torch.device("cpu")

    try:
        free_bytes, _total = torch.cuda.mem_get_info(torch.cuda.current_device())
        if free_bytes < _MIN_CUDA_FREE_BYTES:
            logger.warning(
                "CUDA has %.0f MiB free (need >= %d MiB for page classifier); using CPU",
                free_bytes / (1024 ** 2),
                _MIN_CUDA_FREE_BYTES // (1024 ** 2),
            )
            return torch.device("cpu")
        return torch.device("cuda")
    except Exception as exc:
        logger.warning("CUDA device check failed (%s); using CPU", exc)
        return torch.device("cpu")


DEVICE = resolve_device()

# ── Reproducibility ───────────────────────────────────────────────────────────
SEED = 42

# ── Data splits ───────────────────────────────────────────────────────────────
TRAIN_RATIO = 0.80
VAL_RATIO   = 0.10
# TEST_RATIO  = 0.10  (implicit: 1 - TRAIN - VAL)

# ── Training hyperparameters ─────────────────────────────────────────────────
BATCH_SIZE       = 16       # per-step batch size
GRAD_ACCUM       = 2        # effective batch = BATCH_SIZE * GRAD_ACCUM = 32
MAX_EPOCHS       = 30
LEARNING_RATE    = 2e-5     # for the frozen/unfrozen encoder layers
HEAD_LR_MULT     = 10.0     # classifier head gets LR * HEAD_LR_MULT
WEIGHT_DECAY     = 0.01
WARMUP_RATIO     = 0.06     # fraction of total steps used for LR warmup
EARLY_STOP       = 5        # stop if val macro-F1 doesn't improve for N epochs
LABEL_SMOOTHING  = 0.05     # regularisation to prevent overconfident predictions
MAX_GRAD_NORM    = 1.0

# ── Architecture ──────────────────────────────────────────────────────────────
TEXT_DIM     = 768          # XLM-RoBERTa [CLS] embedding dimension
FEAT_HIDDEN  = 128          # feature MLP hidden dimension
DROPOUT      = 0.25
