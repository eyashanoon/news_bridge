import faiss
import numpy as np
import json
import os

STORE_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
INDEX_PATH = os.path.join(STORE_DIR, "faiss.index")
META_PATH = os.path.join(STORE_DIR, "meta.json")


class VectorStore:
    def __init__(self, dim: int, index_path: str = INDEX_PATH, meta_path: str = META_PATH):
        self.index_path = index_path
        self.meta_path = meta_path
        self.dim = dim

        # Try to load existing index from disk
        if os.path.exists(index_path) and os.path.exists(meta_path):
            self.index = faiss.read_index(index_path)
            with open(meta_path, "r", encoding="utf-8") as f:
                self.meta = json.load(f)
        else:
            self.index = faiss.IndexFlatIP(dim)
            self.meta = []

    def add(self, embedding, metadata):
        embedding = np.array([embedding], dtype=np.float32)
        self.index.add(embedding)
        self.meta.append(metadata)

    def search(self, query_vec, top_k=5):
        query_vec = np.array([query_vec], dtype=np.float32)

        actual_k = min(top_k, self.index.ntotal)
        if actual_k == 0:
            return []

        scores, idxs = self.index.search(query_vec, actual_k)

        results = []
        for score, idx in zip(scores[0], idxs[0]):
            if idx == -1:
                continue

            item = dict(self.meta[idx])
            item["score"] = float(score)
            results.append(item)

        return results

    def save(self):
        """Persist the index and metadata to disk."""
        os.makedirs(STORE_DIR, exist_ok=True)
        faiss.write_index(self.index, self.index_path)
        with open(self.meta_path, "w", encoding="utf-8") as f:
            json.dump(self.meta, f, ensure_ascii=False, default=str)

    def __len__(self):
        return self.index.ntotal