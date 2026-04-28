import re

def merge_paragraphs(content_json: dict) -> str:
    parts = content_json.get("content", [])
    return "\n\n".join(
        p.get("text", "").strip()
        for p in parts
        if p.get("type") == "paragraph"
    )

def chunk_text(text: str, size=250, overlap=50):
    words = text.split()
    chunks = []

    i = 0
    while i < len(words):
        chunk = words[i:i+size]
        chunks.append(" ".join(chunk))
        i += size - overlap

    return chunks
