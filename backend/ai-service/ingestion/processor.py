import re


def merge_paragraphs(content_json: dict) -> str:
    paragraphs = content_json.get("content", [])
    merged = []

    for item in paragraphs:
        if item.get("type") == "paragraph":
            text = item.get("text", "").strip()
            if text:
                merged.append(text)

    return "\n\n".join(merged)


def chunk_text(text: str, min_words=150, max_words=300):
    words = text.split()
    chunks = []

    start = 0
    while start < len(words):
        end = min(start + max_words, len(words))
        chunk_words = words[start:end]

        if len(chunk_words) < min_words and end != len(words):
            # if too small, merge with next
            end = min(start + min_words, len(words))
            chunk_words = words[start:end]

        chunk_text = " ".join(chunk_words).strip()
        chunk_text = re.sub(r"\s+", " ", chunk_text)

        if chunk_text:
            chunks.append(chunk_text)

        start = end

    return chunks
