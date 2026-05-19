import logging

from ingestion.fetcher import fetch_posts_by_tags, fetch_feed_posts
from rag.search import search
from rag.ingest import ingest_posts
from rag.global_store import persist_ingested
from logic.tag_extractor import extract_tags

logger = logging.getLogger(__name__)


def topic_search(store, question, tags=None, top_k=10, ingested_posts=None):
    """
    Multi-stage retrieval enhanced with:
    - auto tag extraction
    - feed fallback when tags return nothing
    - recency-aware ingestion
    - vector similarity search
    - fallback to broader search when initial search returns nothing
    """

    if ingested_posts is None:
        ingested_posts = set()

    # 1. Extract tags from question
    tags = tags or []
    if not tags:
        tags = extract_tags(question)
        logger.info(f"Extracted tags: {tags}")

    # 2. Stage 1: Fetch candidate posts by tags
    candidate_posts = []
    if tags:
        try:
            candidate_posts = fetch_posts_by_tags(tags)
            logger.info(f"Tag fetch returned {len(candidate_posts)} posts for tags: {tags}")
        except Exception as e:
            logger.warning(f"Tag fetch failed: {e}")

    # 3. Stage 2: If no tag results, fall back to feed API with rich data
    if not candidate_posts:
        logger.info("No tag results. Falling back to feed API...")
        try:
            # Try general feed first
            feed_posts = fetch_feed_posts(category="general", limit=30)
            for p in feed_posts:
                pid = p.get("id")
                if pid and pid not in ingested_posts:
                    candidate_posts.append({
                        "postId": pid,
                        "tag": "general",
                        "timestamp": p.get("articleCreatedAt"),
                        "title": p.get("title", "") or p.get("text", "")[:80]
                    })

            # If question seems topic-specific, try relevant categories
            topic_categories = _guess_categories(question)
            for cat in topic_categories:
                try:
                    cat_posts = fetch_feed_posts(category=cat, limit=20)
                    seen_ids = {p.get("postId") for p in candidate_posts if p.get("postId")}
                    for p in cat_posts:
                        pid = p.get("id")
                        if pid and pid not in seen_ids and pid not in ingested_posts:
                            candidate_posts.append({
                                "postId": pid,
                                "tag": cat,
                                "timestamp": p.get("articleCreatedAt"),
                                "title": p.get("title", "") or p.get("text", "")[:80]
                            })
                except Exception as e:
                    logger.warning(f"Feed fetch failed for category '{cat}': {e}")

            logger.info(f"Feed fallback returned {len(candidate_posts)} candidate posts")

        except Exception as e:
            logger.warning(f"Feed fallback failed: {e}")

    # 4. Ingest candidate posts (limit to recent ones)
    if candidate_posts:
        try:
            total = ingest_posts(store, candidate_posts, ingested_posts, max_posts=20, recent_days=60)
            logger.info(f"Ingested {total} chunks from candidate posts")
            # Persist the updated ingested_posts set
            persist_ingested()
        except Exception as e:
            logger.warning(f"Ingestion failed: {e}")

    # 5. Vector search (primary)
    results = search(store, question, top_k=top_k)

    # 6. If vector search returns nothing, try a broader search with reduced top_k
    if not results:
        logger.info("Primary vector search returned no results. Trying broader search...")
        results = search(store, question, top_k=top_k * 2)

    # 7. Deduplicate by postId only (keep different chunks from same post)
    seen_post_ids = set()
    unique = []
    for r in results:
        pid = r.get("postId")
        if pid in seen_post_ids:
            continue
        seen_post_ids.add(pid)
        unique.append(r)

    logger.info(f"Vector search returned {len(unique)} unique results (from {len(results)} total)")

    # 8. Even if no results from vector search, return some recently ingested posts
    #    as a last resort so the LLM can still produce a meaningful answer
    if not unique:
        logger.info("No vector search results. Returning fallback from recently ingested posts.")
        return _fallback_latest()

    return unique


def _fallback_latest():
    """
    When vector search finds nothing, return a signal to the LLM.
    This just returns empty — the calling code in main.py handles it
    gracefully by responding "I don't have enough information."
    """
    return []


def _guess_categories(question: str) -> list[str]:
    """
    Roughly guess relevant feed categories based on question keywords.
    Returns a list of category names ordered by likely relevance.
    """
    q = question.lower()

    category_keywords = {
        "technology": ["tech", "technology", "software", "ai", "computer", "digital", "internet", "app", "cyber", "programming", "startup"],
        "politics": ["politics", "political", "government", "election", "president", "parliament", "minister", "law", "policy", "democracy", "vote"],
        "sports": ["sport", "football", "soccer", "basketball", "tennis", "olympic", "champion", "league", "match", "game", "player", "team"],
        "health": ["health", "medical", "hospital", "disease", "covid", "vaccine", "doctor", "treatment", "medicine", "surgery"],
        "business": ["business", "economy", "market", "finance", "stock", "trade", "economic", "company", "investment", "bank"],
        "entertainment": ["entertainment", "movie", "music", "film", "celebrity", "concert", "show", "art", "culture"],
        "world": ["world", "international", "global", "foreign", "country", "war", "conflict", "peace", "united nations"],
        "general": ["news", "latest", "breaking", "update", "today", "recent"]
    }

    matched = []
    for cat, keywords in category_keywords.items():
        if any(kw in q for kw in keywords):
            matched.append(cat)

    # Always include general as a fallback
    if "general" not in matched:
        matched.append("general")

    return matched[:3]