import faiss
import numpy as np
import json
import os
import hashlib
from config import FAISS_INDEX_PATH, FAISS_META_PATH


class VectorStore:
    def __init__(self, dim: int):
        self.dim = dim

        # Use Inner Product for cosine similarity (with normalization)
        self.index = faiss.IndexFlatIP(dim)

        self.metadata = []
        self.hashes = set()  # O(1) duplicate detection

        self.load()

    def add(self, embedding: np.ndarray, meta: dict):
        # Create deterministic hash
        h = self._hash_chunk(meta["postId"], meta["text"])

        if "chunkHash" not in meta:
            meta["chunkHash"] = h

        # Skip duplicates fast
        if h in self.hashes:
            return

        # Prepare embedding
        embedding = np.array([embedding], dtype=np.float32)

        # Normalize for cosine similarity
        faiss.normalize_L2(embedding)

        # Add to index
        self.index.add(embedding)

        # Store metadata + hash
        self.metadata.append(meta)
        self.hashes.add(h)

    def search(self, query_embedding: np.ndarray, top_k=5):
        if len(self.metadata) == 0:
            return []

        query_embedding = np.array([query_embedding], dtype=np.float32)

        # Normalize query
        faiss.normalize_L2(query_embedding)

        distances, indices = self.index.search(query_embedding, top_k)

        results = []
        for idx in indices[0]:
            if idx == -1:
                continue
            results.append(self.metadata[idx])

        return results

    def save(self):
        # Save FAISS index
        faiss.write_index(self.index, FAISS_INDEX_PATH)

        # Save metadata
        with open(FAISS_META_PATH, "w", encoding="utf-8") as f:
            json.dump(self.metadata, f, ensure_ascii=False, indent=2)

    def load(self):
        if os.path.exists(FAISS_INDEX_PATH) and os.path.exists(FAISS_META_PATH):
            # Load index
            self.index = faiss.read_index(FAISS_INDEX_PATH)

            # Load metadata
            with open(FAISS_META_PATH, "r", encoding="utf-8") as f:
                self.metadata = json.load(f)

            # Rebuild hash set
            self.hashes = {
                m.get("chunkHash")
                for m in self.metadata
                if "chunkHash" in m
            }

    def _hash_chunk(self, post_id: int, text: str):
        raw = f"{post_id}:{text}".encode("utf-8")
        return hashlib.md5(raw).hexdigest()