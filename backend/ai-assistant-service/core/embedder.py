"""Embedding generation via Ollama's nomic-embed-text model.

Produces 768-dimensional L2-normalized embeddings.
Inner product of normalized vectors equals cosine similarity.
"""

import httpx
import numpy as np
from typing import List

from config import settings


class Embedder:
    """Generates normalized embeddings using Ollama's embedding API."""

    def __init__(self) -> None:
        self.base_url = settings.ollama_base_url
        self.model = settings.embedder_model
        self.dim = settings.vector_dim

    def embed(self, text: str) -> np.ndarray:
        """Embed a single text string into a normalized vector."""
        resp = httpx.post(
            f"{self.base_url}/api/embeddings",
            json={"model": self.model, "prompt": text},
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        vec = np.array(data["embedding"], dtype=np.float32)
        # L2-normalize so inner product == cosine similarity
        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm
        return vec

    def embed_batch(self, texts: List[str]) -> np.ndarray:
        """Embed multiple texts; returns shape (n, dim).

        Uses sequential calls since Ollama does not natively batch.
        """
        vectors = []
        for t in texts:
            vectors.append(self.embed(t))
        return np.array(vectors, dtype=np.float32)