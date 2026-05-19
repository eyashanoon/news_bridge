import time
import logging
from datetime import datetime

from config import BACKEND_BASE_URL, BACKEND_TOKEN
from rag.global_store import store, ingested_posts, persist_ingested
from rag.ingest import ingest_posts
from ingestion.fetcher import fetch_feed_posts, fetch_posts_by_tags

logger = logging.getLogger(__name__)


def build_recent_posts_pool(max_posts=50):
    """
    Fetch recent posts from multiple sources to build a diverse pool.
    Tries the feed API first, then common category tags as fallback.
    """
    all_posts = []
    seen_ids = set()

    # 1. Try feed API for general + common categories
    categories = ["general", "technology", "sports", "politics", "health", "business", "entertainment"]
    for cat in categories:
        try:
            feed = fetch_feed_posts(category=cat, limit=20)
            for p in feed:
                pid = p.get("id")
                if pid and pid not in seen_ids:
                    seen_ids.add(pid)
                    all_posts.append({
                        "postId": pid,
                        "tag": cat,
                        "timestamp": p.get("articleCreatedAt") or datetime.utcnow().isoformat(),
                        "title": p.get("title", "") or p.get("text", "")[:80]
                    })
        except Exception as e:
            logger.warning(f"Feed fetch failed for category '{cat}': {e}")

    # 2. Supplement with common broad tags
    broad_tags = ["news", "breaking", "latest", "update", "world", "local", "top"]
    try:
        tag_posts = fetch_posts_by_tags(broad_tags)
        for p in tag_posts:
            pid = p.get("postId")
            if pid and pid not in seen_ids:
                seen_ids.add(pid)
                # PostByTagResponse has no title, so add empty title
                if "title" not in p:
                    p["title"] = ""
                all_posts.append(p)
    except Exception as e:
        logger.warning(f"Tag fetch failed for broad tags: {e}")

    # Limit pool size
    all_posts.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return all_posts[:max_posts]


def auto_ingest_job():
    """
    Periodic job: fetch recent posts and ingest unseen ones into the vector store.
    Runs every N minutes via APScheduler.
    """
    logger.info("Auto-ingest job starting...")
    before_count = store.index.ntotal

    try:
        pool = build_recent_posts_pool(max_posts=50)

        if not pool:
            logger.info("No posts fetched. Skipping ingestion.")
            return

        total = ingest_posts(store, pool, ingested_posts, max_posts=30, recent_days=7)
        after_count = store.index.ntotal

        logger.info(
            f"Auto-ingest complete: ingested {total} chunks, "
            f"store grew from {before_count} to {after_count} vectors"
        )

        # Persist the index and ingested_posts set to disk
        try:
            store.save()
            persist_ingested()
        except Exception as e:
            logger.warning(f"Failed to persist state: {e}")

    except Exception as e:
        logger.error(f"Auto-ingest job failed: {e}", exc_info=True)