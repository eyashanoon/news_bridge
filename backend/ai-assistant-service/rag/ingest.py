# ../backend/ai-assistant-service/rag/ingest.py

from core.embedder import embed
from ingestion.processor import merge_paragraphs, chunk_text
from ingestion.fetcher import fetch_post_content
from datetime import datetime

def parse_timestamp(ts):
    """
    Parse backend timestamp (e.g., ISO string or numeric)
    You may need to adjust depending on format.
    """
    try:
        return datetime.fromisoformat(ts)
    except:
        try:
            return datetime.fromtimestamp(float(ts))
        except:
            return None

def ingest_post(store, post_id: int):
    content = fetch_post_content(post_id)
    text = merge_paragraphs(content)

    if not text.strip():
        return 0

    chunks = chunk_text(text, size=250, overlap=50)
    added = 0

    for chunk in chunks:
        vec = embed(chunk)
        store.add(vec, {
            "postId": post_id,
            "text": chunk
        })
        added += 1

    return added

def ingest_posts(store, posts: list[dict], ingested_set: set, max_posts=10, recent_days=None):
    """
    Ingest up to max_posts most recent posts.
    Optionally filter by recent_days (days old).
    """
    now = datetime.utcnow()
    candidates = []

    for p in posts:
        pid = p.get("postId")
        if pid in ingested_set:
            continue

        ts = parse_timestamp(p.get("timestamp"))
        if ts is None:
            # fallback if no timestamp
            ts = now

        # optional recency window
        if recent_days is not None:
            age_days = (now - ts).days
            if age_days > recent_days:
                continue

        candidates.append((ts, pid))

    # Sort by timestamp descending (newest first)
    candidates.sort(key=lambda x: x[0], reverse=True)

    # Limit number of posts to ingest
    to_ingest = [pid for _, pid in candidates[:max_posts]]

    total_chunks = 0
    for pid in to_ingest:
        chunks_added = ingest_post(store, pid)
        if chunks_added > 0:
            ingested_set.add(pid)
            total_chunks += chunks_added

    return total_chunks