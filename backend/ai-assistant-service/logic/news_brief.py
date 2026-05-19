"""
News Brief logic: fetches recent posts, scores them based on user preferences,
recency, and importance, and returns the top n most newsworthy highlights
for generating a news brief summary.
"""
import logging
from datetime import datetime, timezone, timedelta

from ingestion.fetcher import (
    fetch_feed_posts,
    fetch_user_preferences,
    fetch_post_content,
    fetch_posts_by_tags,
)
from ingestion.processor import merge_paragraphs

logger = logging.getLogger(__name__)

# Weights for the scoring function
WEIGHT_PREFERENCE = 0.40
WEIGHT_RECENCY = 0.35
WEIGHT_IMPORTANCE = 0.25

# Recency decay half-life in hours (higher = slower decay, older posts stay relevant longer)
RECENCY_HALF_LIFE_HOURS = 4.0

# Minimum score threshold — posts below this are excluded
MIN_SCORE_THRESHOLD = 0.10

# Maximum hours old a post can be
MAX_AGE_HOURS = 12


def _recency_score(created_at_str: str) -> float:
    """
    Calculate recency score using exponential decay.
    Returns 1.0 for brand new, decays toward 0 for older posts.
    Does NOT hard-reject old posts — they just get a low score.
    """
    if not created_at_str:
        return 0.0

    try:
        # Parse ISO format timestamp
        created = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        age_hours = (now - created).total_seconds() / 3600.0
    except (ValueError, TypeError):
        return 0.0

    if age_hours < 0:
        age_hours = 0

    # Exponential decay: score = e^(-ln(2) * age / half_life)
    # At age=half_life, score = 0.5; at age=12h, ~0.125; at age=4 days, ~0.008
    # Posts older than MAX_AGE_HOURS get a minimal score instead of 0
    score = 2.0 ** (-age_hours / RECENCY_HALF_LIFE_HOURS)
    
    if age_hours > MAX_AGE_HOURS:
        # Floor to a small value so old posts aren't completely excluded
        score = max(score, 0.01)
    
    return score


def _importance_score(likes: int, dislikes: int) -> float:
    """
    Calculate importance/popularity score.
    Based on engagement ratio with a small base to avoid division by zero.
    """
    total = likes + dislikes
    if total == 0:
        return 0.1  # minimal importance for unrated posts
    # Importance scales with total engagement * positive ratio
    ratio = (likes + 1.0) / (total + 2.0)
    # Scale with log of total engagement (diminishing returns)
    engagement_scale = min(1.0, total / 100.0)
    return ratio * (0.5 + 0.5 * engagement_scale)


def _preference_score(post_tags: list[str], post_label: str, preferences: dict) -> float:
    """
    Calculate user preference affinity score for a post.
    Matches post tags and category/label against the user's weighted preferences.
    """
    if not preferences:
        return 0.3  # neutral score for anonymous/no-preference users

    score = 0.0
    matched = 0

    # Check post tags against preferences
    for tag in post_tags or []:
        tag_lower = tag.lower()
        if tag_lower in preferences:
            score += preferences[tag_lower]
            matched += 1

    # Check post label/category against preferences
    if post_label:
        label_lower = post_label.lower()
        if label_lower in preferences:
            score += preferences[label_lower] * 1.5  # category match weighted higher
            matched += 1

    if matched == 0:
        return 0.2  # no preference match — low but non-zero for discovery

    # Normalize by number of matches to avoid inflating multi-tag posts
    return score / matched


def calculate_dynamic_count(scored_posts: list[dict]) -> int:
    """
    Dynamically determine how many news items to include based on:
    - How many posts are available (minimum floor of 5)
    - The average score of top posts (higher avg = more posts)
    - Maximum cap to prevent overwhelming briefs

    Always returns at least 5 if there are at least 5 posts available,
    even if they fall below the quality threshold.
    """
    total_available = len(scored_posts)

    if total_available == 0:
        return 0

    qualified = [p for p in scored_posts if p["score"] >= MIN_SCORE_THRESHOLD]
    n_qualified = len(qualified)

    # Quality-based scaling: higher avg score = more items
    avg_score_top = sum(p["score"] for p in scored_posts[:5]) / min(5, total_available)

    if avg_score_top > 0.6:
        count = min(total_available, 12)
    elif avg_score_top > 0.4:
        count = min(total_available, 8)
    else:
        count = min(total_available, 5)

    # Enforce minimum floor of 5 (as long as enough posts exist)
    count = max(count, min(total_available, 5))

    return count


def build_news_brief(user_id: str = "android-app-anonymous") -> dict:
    """
    Main entry point: build a news brief for a given user.
    
    Steps:
    1. Fetch user preferences
    2. Fetch recent posts (≤12 hours old)
    3. Score each post based on preference, recency, and importance
    4. Dynamically determine how many to include
    5. Fetch full content for the selected posts
    6. Return structured data for the LLM to summarize
    """
    # 1. Get user preferences
    preferences = fetch_user_preferences(user_id)
    logger.info(f"Loaded {len(preferences)} user preferences")

    # 2. Fetch recent posts across categories
    all_recent = fetch_recent_posts_pool()
    logger.info(f"Fetched {len(all_recent)} recent posts (≤{MAX_AGE_HOURS}h)")

    if not all_recent:
        return {
            "status": "NO_POSTS",
            "brief": None,
            "posts": [],
            "message": "No recent news available in the last 12 hours."
        }

    # 3. Score each post
    scored = []
    for post in all_recent:
        post_id = post.get("id")
        if not post_id:
            continue

        created_at = post.get("articleCreatedAt") or ""
        tags = post.get("tags") or []
        label = post.get("label") or post.get("category", "")
        likes = post.get("likes", 0) or 0
        dislikes = post.get("dislikes", 0) or 0

        recency = _recency_score(str(created_at))

        importance = _importance_score(likes, dislikes)
        preference = _preference_score(tags, label, preferences)

        total_score = (
            WEIGHT_RECENCY * recency
            + WEIGHT_IMPORTANCE * importance
            + WEIGHT_PREFERENCE * preference
        )

        scored.append({
            "postId": post_id,
            "title": post.get("title", "") or "",
            "text_preview": (post.get("text", "") or "")[:200],
            "label": label,
            "tags": tags,
            "likes": likes,
            "dislikes": dislikes,
            "articleCreatedAt": created_at,
            "articleUrl": post.get("articleUrl", ""),
            "score": round(total_score, 4),
            "components": {
                "recency": round(recency, 4),
                "importance": round(importance, 4),
                "preference": round(preference, 4),
            }
        })

    # Sort by score descending
    scored.sort(key=lambda x: x["score"], reverse=True)

    # 4. Dynamically determine count (minimum floor of 5)
    brief_count = calculate_dynamic_count(scored)
    logger.info(f"Dynamic brief count: {brief_count} (from {len(scored)} scored posts)")

    if brief_count == 0:
        return {
            "status": "NO_RECENT_POSTS",
            "brief": None,
            "posts": [],
            "message": "No recent news available in the last 12 hours."
        }

    # 5. Select top posts
    top_posts = scored[:brief_count]

    # 6. Fetch full content for LLM context
    enriched = []
    for p in top_posts:
        try:
            content = fetch_post_content(p["postId"])
            full_text = merge_paragraphs(content)
            p["fullText"] = full_text
        except Exception as e:
            logger.warning(f"Failed to fetch content for post {p['postId']}: {e}")
            p["fullText"] = p.get("text_preview", "")
        enriched.append(p)

    return {
        "status": "SUCCESS",
        "brief": None,  # LLM will generate this
        "posts": enriched,
        "count": brief_count,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "message": f"Generated brief with {brief_count} top news items."
    }


def fetch_recent_posts_pool() -> list[dict]:
    """
    Fetch recent posts from multiple category feeds to build a diverse pool.
    Only includes posts ≤ MAX_AGE_HOURS old.
    """
    all_posts = []
    seen_ids = set()

    categories = ["general", "technology", "sports", "politics", "health", "business", "entertainment"]
    for cat in categories:
        try:
            feed = fetch_feed_posts(category=cat, limit=15, page=0)
            for p in feed:
                pid = p.get("id")
                if pid and pid not in seen_ids:
                    seen_ids.add(pid)
                    all_posts.append(p)
        except Exception as e:
            logger.warning(f"Feed fetch failed for category '{cat}': {e}")

    # Also try fetching by broad tags
    broad_tags = ["breaking", "latest", "news", "top", "urgent"]
    try:
        tag_posts = fetch_posts_by_tags(broad_tags)
        for p in tag_posts:
            pid = p.get("postId")
            if pid and pid not in seen_ids:
                seen_ids.add(pid)
                if "title" not in p:
                    p["title"] = ""
                all_posts.append({
                    "id": pid,
                    "title": p.get("title", ""),
                    "text": p.get("text", ""),
                    "label": p.get("tag", "general"),
                    "tags": [p.get("tag", "general")],
                    "likes": p.get("likes", 0),
                    "dislikes": p.get("dislikes", 0),
                    "articleCreatedAt": p.get("timestamp", ""),
                })
    except Exception as e:
        logger.warning(f"Tag fetch failed for broad tags: {e}")

    return all_posts