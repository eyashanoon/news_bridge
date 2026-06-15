# ../backend/ai-assistant-service/rag/ingest.py

from core.embedder import embed
from ingestion.processor import merge_paragraphs, chunk_text
from ingestion.fetcher import fetch_post_content
from datetime import datetime, timezone
def parse_timestamp(ts):
    """
    Parse backend timestamp (e.g., ISO string or numeric)
    You may need to adjust depending on format.
    """
    try:
        return datetime.fromisoformat(ts).replace(tzinfo=timezone.utc)
    except:
        try:
            return datetime.fromtimestamp(float(ts))
        except:
            return None

def _extract_first_line(text: str, max_chars: int = 80) -> str:
    """Extract first meaningful line from text as a pseudo-title."""
    for line in text.split("\n"):
        stripped = line.strip()
        if len(stripped) > 10:
            return stripped[:max_chars]
    return text[:max_chars]

def ingest_post(store, post_id: int, title: str = ""):
    content = fetch_post_content(post_id)
    text = merge_paragraphs(content)

    if not text.strip():
        return 0

    # Use provided title, or derive one from first line of content
    if not title:
        title = _extract_first_line(text)

    prefix = f"[Title: {title}]\n\n" if title else ""
    full_text = prefix + text

    chunks = chunk_text(full_text, size=250, overlap=50)
    added = 0

    for chunk in chunks:
        vec = embed(chunk)
        store.add(vec, {
            "postId": post_id,
            "text": chunk,
            "title": title
        })
        added += 1

    return added

def ingest_posts(store, posts: list[dict], ingested_set: set, max_posts=10, recent_days=None):
    """
    Ingest up to max_posts most recent posts.
    Optionally filter by recent_days (days old).
    Each post dict should have: postId, and optionally: title, timestamp.
    """
    now = datetime.now(timezone.utc)
    candidates = []

    for p in posts:
        pid = p.get("postId")
        if pid in ingested_set:
            continue

        ts = parse_timestamp(p.get("timestamp"))
        if ts is None:
            ts = now

        if recent_days is not None:
            age_days = (now - ts).days
            if age_days > recent_days:
                continue

        candidates.append((ts, pid, p.get("title", "")))

    # Sort by timestamp descending (newest first)
    candidates.sort(key=lambda x: x[0], reverse=True)

    # Limit number of posts to ingest
    to_ingest = candidates[:max_posts]

    total_chunks = 0
    for ts, pid, title in to_ingest:
        chunks_added = ingest_post(store, pid, title=title)
        if chunks_added > 0:
            ingested_set.add(pid)
            total_chunks += chunks_added

    return total_chunks