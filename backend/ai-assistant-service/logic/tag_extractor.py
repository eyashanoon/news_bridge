import json
import re
import requests
from config import OLLAMA_URL, LLM_MODEL


def extract_tags(question: str) -> list[str]:
    prompt = f"""
You are a tag extraction system.

Extract 3-8 important tags from the question.
Tags should be short keywords or named entities.

Return ONLY valid JSON like:
["tag1","tag2","tag3"]

Question:
{question}
"""

    res = requests.post(f"{OLLAMA_URL}/api/generate", json={
        "model": LLM_MODEL,
        "prompt": prompt,
        "stream": False
    })

    res.raise_for_status()
    raw = res.json()["response"].strip()

    # try to find JSON array
    match = re.search(r"\[.*\]", raw, re.DOTALL)
    if not match:
        return []

    try:
        tags = json.loads(match.group(0))
        if not isinstance(tags, list):
            return []
        clean = []
        for t in tags:
            if isinstance(t, str):
                t = t.strip().lower()
                if len(t) > 1 and t not in clean:
                    clean.append(t)
        return clean[:8]
    except:
        return []