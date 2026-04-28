import requests
import numpy as np
from config import OLLAMA_URL, EMBEDDING_MODEL

def embed_text(text: str) -> np.ndarray:
    # Ensure no trailing slashes in OLLAMA_URL
    url = f"{OLLAMA_URL.rstrip('/')}/api/embed"
    print("url: ", url)
    print("text: ", text)
    payload = {
        "model": EMBEDDING_MODEL,
        "input": text  # The new API expects "input", not "prompt"
    }
    print("payload: ", payload)

    res = requests.post(url, json=payload)

    if res.status_code == 404:
        # Fallback for older Ollama versions if /api/embed isn't registered
        url = f"{OLLAMA_URL.rstrip('/')}/api/embeddings"
        payload = {"model": EMBEDDING_MODEL, "prompt": text}
        res = requests.post(url, json=payload)

    res.raise_for_status()
    data = res.json()

    # The new /api/embed returns "embeddings" (plural)
    # The old /api/embeddings returns "embedding" (singular)
    if "embeddings" in data:
        embedding = data["embeddings"][0]
    else:
        embedding = data["embedding"]

    
    print("EMBED RESPONSE:", data)
    print("EMBED LENGTH:", len(embedding))
    
    return np.array(embedding, dtype=np.float32)
