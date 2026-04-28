import faiss
import numpy as np


class VectorStore:
    def __init__(self, dim: int):
        self.index = faiss.IndexFlatIP(dim)
        self.meta = []

    def add(self, embedding, metadata):
        embedding = np.array([embedding], dtype=np.float32)
        self.index.add(embedding)
        self.meta.append(metadata)

    def search(self, query_vec, top_k=5):
        query_vec = np.array([query_vec], dtype=np.float32)

        scores, idxs = self.index.search(query_vec, top_k)

        results = []
        for score, idx in zip(scores[0], idxs[0]):
            if idx == -1:
                continue

            item = dict(self.meta[idx])
            item["score"] = float(score)
            results.append(item)

        return results