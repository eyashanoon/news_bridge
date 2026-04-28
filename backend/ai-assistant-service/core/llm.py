import requests
from config import OLLAMA_URL, LLM_MODEL


def generate(question: str, context: list[dict]) -> str:
    context_text = "\n\n".join(
        [f"[Post {c.get('postId')}] {c.get('text')}" for c in context]
    )

    prompt = f"""
You are a news assistant.

Use ONLY the context below to answer.
If the context is insufficient, respond exactly with:
"I don't have enough information."

Context:
{context_text}

Question:
{question}

Answer clearly and concisely:
"""

    res = requests.post(f"{OLLAMA_URL}/api/generate", json={
        "model": LLM_MODEL,
        "prompt": prompt,
        "stream": False
    })

    res.raise_for_status()
    return res.json()["response"].strip()