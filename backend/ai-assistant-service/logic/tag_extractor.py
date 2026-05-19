import json
import re
import requests
from config import OLLAMA_URL, LLM_MODEL


# Common known tags from the database to help guide extraction
KNOWN_TAGS = [
    "gaza", "palestine", "israel", "war", "conflict", "ceasefire", "peace",
    "usa", "ukraine", "russia", "china", "europe", "middle east",
    "election", "president", "parliament", "government", "protest",
    "economy", "business", "market", "finance", "inflation", "trade",
    "technology", "ai", "tech", "cyber", "internet", "digital",
    "health", "covid", "vaccine", "medical", "hospital",
    "sports", "football", "soccer", "olympic", "champion",
    "climate", "environment", "weather", "earthquake", "flood",
    "education", "science", "space", "energy", "oil",
    "crime", "terrorism", "security", "army", "defense",
    "culture", "entertainment", "movie", "music", "art",
    "breaking", "latest", "news", "update", "top story",
    "local", "world", "international"
]


def extract_tags(question: str) -> list[str]:
    """
    Extract relevant tags from a user's question using the LLM.
    Uses known tags as context to guide better extraction.
    Returns a deduplicated list of up to 5 tags.
    """
    known_tags_str = ", ".join(KNOWN_TAGS)

    prompt = f"""
You are a tag extraction system for a news platform.

Extract 2-5 meaningful tags from the question below.
Tags should be short keywords or named entities relevant to news articles.

Where possible, choose from this list of known tags:
{known_tags_str}

If nothing from the known list fits, suggest your own short tags.

Return ONLY valid JSON like:
["tag1","tag2","tag3"]

Question:
{question}
"""

    try:
        res = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={"model": LLM_MODEL, "prompt": prompt, "stream": False},
            timeout=30
        )
        res.raise_for_status()
        raw = res.json()["response"].strip()
    except Exception as e:
        print(f"Tag extraction LLM call failed: {e}")
        # Fallback: simple keyword extraction
        return _fallback_tags(question)

    # Try to find JSON array in the response
    match = re.search(r"\[.*\]", raw, re.DOTALL)
    if not match:
        return _fallback_tags(question)

    try:
        tags = json.loads(match.group(0))
        if not isinstance(tags, list):
            return _fallback_tags(question)

        clean = []
        for t in tags:
            if isinstance(t, str):
                t = t.strip().lower()
                if len(t) > 1 and t not in clean:
                    clean.append(t)
        return clean[:5]
    except:
        return _fallback_tags(question)


def _fallback_tags(question: str) -> list[str]:
    """
    Simple keyword-based tag extraction as fallback when LLM fails.
    """
    q = question.lower()
    found = []

    for tag in KNOWN_TAGS:
        if tag in q and tag not in found:
            found.append(tag)

    # Also extract capitalized phrases as potential named entities
    phrases = re.findall(r'[A-Z][a-z]+(?:\s[A-Z][a-z]+)*', question)
    for phrase in phrases:
        phrase_lower = phrase.lower().strip()
        if len(phrase_lower) > 2 and phrase_lower not in found:
            found.append(phrase_lower)

    return found[:5]