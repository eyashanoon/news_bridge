"""HTTP client for the News Bridge backend Java API.

Fetches posts, post content, and user preferences from the backend.
"""

import httpx
import logging
from typing import List, Dict, Optional, Any
from datetime import datetime, timedelta

from config import settings

logger = logging.getLogger(__name__)


class BackendClient:
    """Thin wrapper around the backend REST API."""

    def __init__(self) -> None:
        self.base_url = settings.backend_base_url
        headers = {}
        if settings.backend_token:
            headers["Authorization"] = f"Bearer {settings.backend_token}"
        self.client = httpx.AsyncClient(timeout=15, headers=headers)

    async def close(self) -> None:
        await self.client.aclose()

    # ------------------------------------------------------------------
    # Posts
    # ------------------------------------------------------------------

    async def get_post_content(self, post_id: int) -> Optional[Dict[str, Any]]:
        """Fetch full article content for a single post by ID.

        Uses the PostController endpoint: /api/posts/{id}/content
        Returns ArticleContentResponse which is either:
          - A dict with 'content' as a list of paragraph objects
          - Or a dict with 'title' and 'content' as string

        The content list is merged into a single text string for embedding.
        """
        try:
            resp = await self.client.get(f"{self.base_url}/posts/{post_id}/content")
            resp.raise_for_status()
            data = resp.json()

            # Get the title - might come from the post metadata or the content response
            title = data.get("title", "")

            # Content may be a list of paragraph objects or a plain string
            raw_content = data.get("content", "")
            if isinstance(raw_content, list):
                # Merge paragraphs into a single text string
                parts = []
                for item in raw_content:
                    if isinstance(item, dict):
                        text = item.get("text") or ""
                    else:
                        text = str(item) if item else ""
                    if text and text.strip():
                        parts.append(text.strip())
                text = "\n\n".join(parts)
            elif isinstance(raw_content, str):
                text = raw_content
            else:
                text = str(raw_content) if raw_content else ""

            # If title is empty, also fetch post metadata from search endpoint
            if not title:
                meta = await self.get_post_by_id(post_id)
                if meta:
                    title = meta.get("title") or meta.get("text", "") or ""

            return {"title": title, "content": text}
        except (httpx.HTTPStatusError, httpx.RequestError) as e:
            logger.warning("Failed to fetch post %d content: %s", post_id, e)
            return None

    async def get_post_by_id(self, post_id: int) -> Optional[Dict[str, Any]]:
        """Fetch a single post's metadata by ID.

        Uses the SearchController endpoint: /api/posts/search/{id}
        which returns FeedPostDTO.
        """
        try:
            resp = await self.client.get(f"{self.base_url}/posts/search/{post_id}")
            resp.raise_for_status()
            return resp.json()
        except (httpx.HTTPStatusError, httpx.RequestError) as e:
            logger.warning("Failed to fetch post %d by id: %s", post_id, e)
            return None

    async def get_recent_posts(self, hours: int = 24) -> List[Dict[str, Any]]:
        """Fetch recent article posts for the news brief (telegram excluded).

        Uses FeedController: /api/feed/brief
        """
        try:
            # ~2 posts/hour heuristic; brief service filters by recency again
            limit = max(30, min(80, hours * 2))
            resp = await self.client.get(
                f"{self.base_url}/feed/brief", params={"limit": limit}
            )
            if resp.status_code in (401, 403):
                logger.warning("Backend auth failure for brief feed")
                return []
            resp.raise_for_status()
            posts = resp.json()
            return posts if isinstance(posts, list) else []
        except (httpx.HTTPStatusError, httpx.RequestError) as e:
            logger.warning("Failed to fetch brief feed: %s", e)
            return []

    async def search_posts_by_tags(self, tags: List[str], limit: int = 10) -> List[Dict[str, Any]]:
        """Search recent posts that match the given tags, up to `limit` results.

        Uses the PostController endpoint: /api/posts/by-tags/recent?tags=tag1&tags=tag2&limit=N
        Returns List<PostByTagResponse> sorted by most recent first.
        Each result has: {postId, tag, timestamp}.
        """
        try:
            normalized = list(dict.fromkeys(
                t.strip().lower() for t in tags if t and t.strip()
            ))
            if not normalized:
                return []
            params = [("tags", tag) for tag in normalized]
            params.append(("limit", limit))
            resp = await self.client.get(
                f"{self.base_url}/posts/by-tags/recent", params=params
            )
            if resp.status_code in (401, 403):
                logger.warning("Backend auth failure for tag search")
                return []
            resp.raise_for_status()
            results = resp.json()
            logger.info(
                "Tag search tags=%s limit=%d returned %d posts",
                normalized, limit, len(results) if isinstance(results, list) else 0,
            )
            return results
        except (httpx.HTTPStatusError, httpx.RequestError) as e:
            logger.warning("Failed to search posts by tags %s: %s", tags, e)
            return []

    async def search_posts_by_query(self, query: str, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """Search posts by keyword across title and text.

        Uses the SearchController endpoint: /api/posts/search?query=...
        Returns List<FeedPostDTO>.
        """
        try:
            params: dict = {"query": query}
            if category:
                params["category"] = category
            resp = await self.client.get(
                f"{self.base_url}/posts/search", params=params
            )
            if resp.status_code in (401, 403):
                logger.warning("Backend auth failure for query search")
                return []
            resp.raise_for_status()
            return resp.json()
        except (httpx.HTTPStatusError, httpx.RequestError) as e:
            logger.warning("Failed to search posts by query: %s", e)
            return []

    async def get_posts_by_category(self, category: str) -> List[Dict[str, Any]]:
        """Fetch posts from a specific category feed.

        Uses the FeedController endpoint: /api/feed?category=...
        """
        try:
            params = {"category": category}
            resp = await self.client.get(
                f"{self.base_url}/feed", params=params
            )
            if resp.status_code in (401, 403):
                logger.warning("Backend auth failure for category feed")
                return []
            resp.raise_for_status()
            return resp.json()
        except (httpx.HTTPStatusError, httpx.RequestError) as e:
            logger.warning("Failed to fetch category '%s' feed: %s", category, e)
            return []

    # ------------------------------------------------------------------
    # User preferences (for news brief)
    # ------------------------------------------------------------------

    async def get_user_preferences(self, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Fetch user preferences as {tags: {tag: weight}, categories: {}}."""
        if not user_id:
            return {"tags": {}, "categories": {}}
        try:
            resp = await self.client.get(
                f"{self.base_url}/users/{user_id}/preferences"
            )
            if resp.status_code in (401, 403):
                logger.warning("Backend auth failure for preferences")
                return {"tags": {}, "categories": {}}
            resp.raise_for_status()
            raw = resp.json()
            tags: Dict[str, float] = {}
            if isinstance(raw, list):
                for item in raw:
                    if isinstance(item, dict) and item.get("tag"):
                        tags[str(item["tag"])] = float(item.get("weight", 0))
            elif isinstance(raw, dict):
                tags = raw.get("tags", {}) or {}
            return {"tags": tags, "categories": {}}
        except (httpx.HTTPStatusError, httpx.RequestError) as e:
            logger.warning("Failed to fetch user preferences: %s", e)
            return {"tags": {}, "categories": {}}
