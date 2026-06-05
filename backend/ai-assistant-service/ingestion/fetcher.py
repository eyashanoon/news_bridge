import requests
import logging
from config import BACKEND_BASE_URL, BACKEND_TOKEN

logger = logging.getLogger(__name__)

headers = {"Authorization": f"Bearer {BACKEND_TOKEN}"}


def _safe_get(url, params=None, timeout=15):
    """
    Perform a GET request and return the JSON response, or None on failure.
    Handles 403/401 gracefully (expired token, insufficient permissions).
    """
    try:
        res = requests.get(url, headers=headers, params=params, timeout=timeout)
        if res.status_code == 200:
            return res.json()
        elif res.status_code in (401, 403):
            logger.warning(f"Auth error {res.status_code} for GET {url} — token may be expired")
        else:
            logger.warning(f"HTTP {res.status_code} for GET {url}")
        return None
    except requests.Timeout:
        logger.warning(f"Timeout for GET {url}")
        return None
    except requests.ConnectionError:
        logger.warning(f"Connection error for GET {url} — backend may be down")
        return None
    except Exception as e:
        logger.warning(f"Request failed for GET {url}: {e}")
        return None


def fetch_posts_by_tags(tags):
    if not tags:
        return []
    result = _safe_get(
        f"{BACKEND_BASE_URL}/posts/by-tags",
        params=[("tags", t) for t in tags]
    )
    return result if result is not None else []


def fetch_post_content(post_id):
    result = _safe_get(
        f"{BACKEND_BASE_URL}/posts/{post_id}/content"
    )
    return result if result is not None else {"content": []}


def fetch_user_preferences(user_id: str) -> dict:
    """
    Fetch user preference weights from the backend.
    Returns a dict mapping tag/category -> weight.
    """
    result = _safe_get(
        f"{BACKEND_BASE_URL}/users/{user_id}/preferences"
    )
    if result is None:
        return {}
    # Expected format: [{"tag": "...", "weight": N}, ...]
    if isinstance(result, list):
        return {item.get("tag", "").lower(): item.get("weight", 0) for item in result}
    return {}


def fetch_recent_posts_since(hours: int = 12, limit: int = 50) -> list[dict]:
    """
    Fetch posts created within the last N hours from the feed endpoint,
    across all categories to build a comprehensive recent pool.
    """
    all_posts = []
    seen_ids = set()
    categories = ["general", "technology", "sports", "politics", "health", "business", "entertainment"]

    from datetime import datetime, timezone
    cutoff = datetime.now(timezone.utc)

    for cat in categories:
        try:
            feed = fetch_feed_posts(category=cat, limit=limit // len(categories))
            for p in feed:
                pid = p.get("id")
                if pid and pid not in seen_ids:
                    seen_ids.add(pid)
                    all_posts.append(p)
        except Exception:
            pass

    return all_posts


def fetch_feed_posts(category="general", limit=30, page=0):
    """
    Fetch posts from the main feed API.
    GET /api/feed?category=...&limit=...&page=...

    Tries multiple URL patterns for flexibility.
    """
    urls = [
        f"{BACKEND_BASE_URL}/feed",
        f"{BACKEND_BASE_URL.replace('/api', '')}/api/feed",
    ]

    params = {
        "category": category,
        "limit": limit,
        "page": page
    }

    for url in urls:
        result = _safe_get(url, params=params)
        if result is not None:
            return result

    logger.warning(f"All feed URL patterns failed for category={category}")
    return []


def fetch_brief_feed(limit=30):
    """
    Fetch recent posts for the news brief — uses a dedicated endpoint
    that does NOT filter by tagsExtracted, ensuring new unprocessed posts appear.
    GET /api/feed/brief?limit=...
    """
    url = f"{BACKEND_BASE_URL}/feed/brief"
    result = _safe_get(url, params={"limit": limit})
    if result is not None:
        return result

    # Fallback: try the regular feed
    logger.warning("Brief feed endpoint failed, falling back to regular feed")
    return fetch_feed_posts(category="general", limit=limit, page=0)
