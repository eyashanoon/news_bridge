import requests
from config import OLLAMA_URL, LLM_MODEL


def generate_answer(question: str, chunks: list[dict]) -> str:
    context_text = "\n\n".join(
        [f"[Post {c['postId']}] {c['text'][:500]}" for c in chunks]
    )

    prompt = f"""
You are a news assistant.
Answer the question ONLY using the provided context.
If the context is insufficient, say: "I don't have enough information."

Context:
{context_text}

Question:
{question}

Answer in a short, clear response:
"""

    payload = {
        "model": LLM_MODEL,
        "prompt": prompt,
        "stream": False
    }

    res = requests.post(f"{OLLAMA_URL}/api/generate", json=payload)
    res.raise_for_status()

    return res.json()["response"].strip()
