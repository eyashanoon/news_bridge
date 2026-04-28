import requests
import numpy as np
from config import OLLAMA_URL, EMBEDDING_MODEL

def embed(text: str) -> np.ndarray:
    url = f"{OLLAMA_URL}/api/embeddings"

    res = requests.post(url, json={
        "model": EMBEDDING_MODEL,
        "prompt": text
    })

    res.raise_for_status()
    data = res.json()

    embedding = data.get("embedding") or data.get("embeddings")[0]

    vec = np.array(embedding, dtype=np.float32)

    # normalize for cosine similarity
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm

    return vec
