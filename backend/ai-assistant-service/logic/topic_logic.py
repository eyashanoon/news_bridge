# ../backend/ai-assistant-service/logic/topic_logic.py

from ingestion.fetcher import fetch_posts_by_tags
from rag.search import search
from rag.ingest import ingest_posts
from logic.tag_extractor import extract_tags

def topic_search(store, question, tags=None, top_k=5, ingested_posts=None):
    """
    Retrieval enhanced with:
    - auto tag extraction
    - recency-aware ingestion
    - vector similarity search
    """

    if ingested_posts is None:
        ingested_posts = set()

    # 1. Tags
    tags = tags or []
    if not tags:
        tags = extract_tags(question)

    # 2. Fetch candidate posts by tags
    candidate_posts = []
    if tags:
        try:
            candidate_posts = fetch_posts_by_tags(tags)
        except Exception as e:
            print("Tag fetch failed:", e)

    # 3. Ingest up to some number of recent posts
    if candidate_posts:
        # ingest only recent posts, limit to e.g. 10
        ingest_posts(store, candidate_posts, ingested_posts, max_posts=10, recent_days=30)

    # 4. Now vector search
    results = search(store, question, top_k=top_k)

    # Deduplicate
    seen = set()
    unique = []
    for r in results:
        key = (r.get("postId"), r.get("text"))
        if key in seen:
            continue
        seen.add(key)
        unique.append(r)

    return unique