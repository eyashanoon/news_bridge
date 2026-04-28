import requests
from config import OLLAMA_URL, LLM_MODEL
from ingestion.processor import merge_paragraphs

def summarize_post(fetch_post_content, post_id):
    content = fetch_post_content(post_id)
    text = merge_paragraphs(content)

    prompt = f"""
You are a news assistant.

Summarize this article clearly and simply:

{text}

Summary:
"""

    res = requests.post(f"{OLLAMA_URL}/api/generate", json={
        "model": LLM_MODEL,
        "prompt": prompt,
        "stream": False
    })

    res.raise_for_status()
    return res.json()["response"].strip()
