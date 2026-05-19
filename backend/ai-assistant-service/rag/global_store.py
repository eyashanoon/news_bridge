import json
import os
from rag.store import VectorStore

STORE_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
INGESTED_PATH = os.path.join(STORE_DIR, "ingested_posts.json")

store = VectorStore(dim=768)

# Track ingested post IDs (persisted to disk)
ingested_posts = set()

# Load ingested_posts from disk if available
if os.path.exists(INGESTED_PATH):
    try:
        with open(INGESTED_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            ingested_posts = set(data)
    except Exception:
        ingested_posts = set()


def persist_ingested():
    """Save ingested_posts set to disk."""
    os.makedirs(STORE_DIR, exist_ok=True)
    with open(INGESTED_PATH, "w", encoding="utf-8") as f:
        json.dump(list(ingested_posts), f, ensure_ascii=False)