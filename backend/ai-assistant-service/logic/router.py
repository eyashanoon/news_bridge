"""Intent router — classifies whether a query is:

- POST_SUMMARY: user wants a summary of a specific article
- POST_QA: user is asking a question about a specific article
- TOPIC_SEARCH: user wants information about a general topic
"""

from enum import Enum
from typing import Tuple


class QueryIntent(str, Enum):
    POST_SUMMARY = "post_summary"
    POST_QA = "post_qa"
    TOPIC_SEARCH = "topic_search"


def classify_query(query: str) -> Tuple[QueryIntent, str]:
    """Classify the user's query into an intent.

    Uses simple heuristics. Returns (intent, extracted_identifier)
    where identifier may be a post ID or empty string.

    This can be enhanced with LLM-based routing in the future.
    """
    q = query.strip().lower()

    # Detect post-summary intent
    summary_triggers = [
        "summarize", "summary", "tl;dr", "tl;dr", "give me a summary",
        "summarise",
    ]
    for trigger in summary_triggers:
        if trigger in q:
            return (QueryIntent.POST_SUMMARY, _extract_post_ref(q))

    # Detect post-specific QA
    qa_post_triggers = [
        "about this article", "about this post", "what does this article",
        "explain this", "tell me about this",
    ]
    for trigger in qa_post_triggers:
        if trigger in q:
            return (QueryIntent.POST_QA, _extract_post_ref(q))

    # Default to topic search
    return (QueryIntent.TOPIC_SEARCH, "")


def _extract_post_ref(query: str) -> str:
    """Try to extract a post ID or URL reference from the query."""
    # If the query contains a number that looks like a post ID
    words = query.split()
    for word in words:
        word = word.strip(",.;:!?")
        if word.isdigit() and len(word) >= 3:
            return word
    return ""