"""Vector store using FAISS (IndexFlatIP).

Persisted to disk as faiss.index + meta.json for restarts.
Stores text chunks with embeddings and metadata (postId, title, text).
"""

import json
import os
import faiss
import numpy as np
from typing import List, Dict, Optional, Tuple

from config import settings


class VectorStore:
    """FAISS-based vector store with disk persistence."""

    def __init__(self) -> None:
        self.dim = settings.vector_dim
        self.index_path = settings.vector_store_path
        self.meta_path = settings.meta_store_path

        self.index: faiss.Index = faiss.IndexFlatIP(self.dim)
        self.metadata: List[Dict] = []  # parallel list, one entry per vector
        self._load()

    # ------------------------------------------------------------------
    # Persistence
    # ------------------------------------------------------------------

    def _load(self) -> None:
        """Load index + metadata from disk if they exist."""
        if os.path.exists(self.index_path) and os.path.exists(self.meta_path):
            self.index = faiss.read_index(self.index_path)
            with open(self.meta_path, "r", encoding="utf-8") as f:
                self.metadata = json.load(f)

    def _save(self) -> None:
        """Write index + metadata to disk."""
        os.makedirs(os.path.dirname(self.index_path), exist_ok=True)
        faiss.write_index(self.index, self.index_path)
        with open(self.meta_path, "w", encoding="utf-8") as f:
            json.dump(self.metadata, f, ensure_ascii=False, indent=2)

    # ------------------------------------------------------------------
    # Operations
    # ------------------------------------------------------------------

    def add(
        self,
        vectors: np.ndarray,
        meta_list: List[Dict],
    ) -> None:
        """Add vectors and their metadata to the store.

        Args:
            vectors: shape (n, dim) float32 array, already normalized.
            meta_list: list of dicts with at least 'postId', 'title', 'text'.
        """
        if len(vectors) != len(meta_list):
            raise ValueError("vectors and meta_list must have the same length")

        self.index.add(vectors)
        self.metadata.extend(meta_list)
        self._save()

    def search(
        self,
        query_vector: np.ndarray,
        top_k: int = 5,
    ) -> List[Tuple[float, Dict]]:
        """Search for the top_k most similar vectors.

        Args:
            query_vector: shape (dim,) normalized vector.
            top_k: number of results to return (clamped to index size).

        Returns:
            List of (score, metadata_dict) tuples, highest score first.
        """
        if self.index.ntotal == 0:
            return []

        k = min(top_k, self.index.ntotal)
        # query_vector must be shape (1, dim)
        scores, indices = self.index.search(query_vector.reshape(1, -1), k)

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx >= 0 and idx < len(self.metadata):
                results.append((float(score), self.metadata[int(idx)]))
        return results

    @property
    def size(self) -> int:
        """Number of vectors currently in the store."""
        return self.index.ntotal

    def clear(self) -> None:
        """Remove all vectors and metadata."""
        self.index = faiss.IndexFlatIP(self.dim)
        self.metadata = []
        if os.path.exists(self.index_path):
            os.remove(self.index_path)
        if os.path.exists(self.meta_path):
            os.remove(self.meta_path)

    def get_post_ids(self) -> set:
        """Return the set of unique postIds currently stored."""
        return {m["postId"] for m in self.metadata if "postId" in m}