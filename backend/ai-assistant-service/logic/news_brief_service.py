"""News Brief service — generates top-of-the-hour news highlights.

Scoring formula:
- Preference affinity (40%) — matches post tags/category against user preferences
- Recency (35%) — exponential decay with 4-hour half-life
- Importance/popularity (25%) — based on likes/dislikes ratio
"""

import logging
import math
from datetime import datetime, timezone
from typing import List, Dict, Optional, Any

from config import settings
from core.llm import LLM
from logic.backend_client import BackendClient

logger = logging.getLogger(__name__)

RECENCY_HALF_LIFE_HOURS = 4


class NewsBriefService:
    """Generates personalised AI news briefs."""

    def __init__(
        self,
        llm: LLM,
        backend: BackendClient,
    ) -> None:
        self.llm = llm
        self.backend = backend

    async def generate_brief(
        self,
        user_id: Optional[str] = None,
        language: str = "english",
        max_posts: int = 12,
        min_posts: int = 5,
    ) -> Dict[str, Any]:
        """Generate a news brief for the user.

        Args:
            user_id: Optional user ID for personalised preferences.
            language: 'english' or 'arabic'.
            max_posts: maximum number of posts to include.
            min_posts: minimum number of posts to include.

        Returns:
            Dict with 'posts' (scored posts) and optionally 'brief_text' (LLM-generated).
        """
        logger.info("NEWS BRIEF requested — user_id=%s, language=%s", user_id, language)

        # 1. Fetch user preferences
        prefs = await self.backend.get_user_preferences(user_id)
        weighted_tags = prefs.get("tags", {})  # {"tag": weight}
        weighted_categories = prefs.get("categories", {})

        # 2. Fetch recent posts (≤ 12 hours old)
        posts = await self.backend.get_recent_posts(hours=12)
        if not posts:
            logger.info("No recent posts found for news brief")
            return {
                "posts": [],
                "brief_text": "No recent news available at this time.",
            }

        logger.info("Fetched %d candidate posts for brief", len(posts))

        # 3. Score each post
        now = datetime.now(timezone.utc)
        scored = []
        for post in posts:
            total_score = self._score_post(post, weighted_tags, weighted_categories, now)
            # Attach score and component breakdown to the post dict for the frontend
            post["score"] = round(total_score, 4)
            post["components"] = {
                "recency": round(self._recency_score(post, now), 4),
                "importance": round(self._importance_score(post), 4),
                "preference": round(self._preference_affinity(post, weighted_tags, weighted_categories), 4),
            }
            scored.append((total_score, post))

        # 4. Sort by score descending and select top posts
        scored.sort(key=lambda x: x[0], reverse=True)
        selected_count = max(min_posts, min(max_posts, len(scored)))
        selected = [sp[1] for sp in scored[:selected_count]]
        avg_score = (
            sum(sp[0] for sp in scored[:selected_count]) / selected_count
            if selected_count
            else 0.0
        )
        logger.info("Selected %d posts, avg score: %.4f", selected_count, avg_score)

        result = {
            "posts": selected,
            "average_score": round(avg_score, 4),
            "total_candidates": len(posts),
            "selected_count": selected_count,
        }

        # 5. Translate post titles and summaries if Arabic
        if language == "arabic" and self.llm.is_available():
            selected = self._translate_posts(selected)

        # 6. Generate LLM-written brief (optional)
        brief_text = self._generate_brief_text(selected, language)
        result["brief_text"] = brief_text

        return result

    # ------------------------------------------------------------------
    # Scoring
    # ------------------------------------------------------------------

    def _score_post(
        self,
        post: Dict,
        weighted_tags: Dict[str, float],
        weighted_categories: Dict[str, float],
        now: datetime,
    ) -> float:
        """Compute a composite score for a single post."""
        # Preference affinity (40%)
        affinity = self._preference_affinity(post, weighted_tags, weighted_categories)

        # Recency (35%)
        recency = self._recency_score(post, now)

        # Importance/popularity (25%)
        importance = self._importance_score(post)

        return 0.40 * affinity + 0.35 * recency + 0.25 * importance

    def _preference_affinity(
        self,
        post: Dict,
        weighted_tags: Dict[str, float],
        weighted_categories: Dict[str, float],
    ) -> float:
        """Score how well the post matches user preferences."""
        post_tags = post.get("tags", [])
        if isinstance(post_tags, str):
            post_tags = [t.strip() for t in post_tags.split(",")]

        post_category = post.get("category") or post.get("label") or ""

        # If no user preferences, return a neutral score
        if not weighted_tags and not weighted_categories:
            return 0.3

        tag_score = 0.0
        if weighted_tags and post_tags:
            matches = sum(
                weighted_tags.get(tag, 0.0)
                for tag in post_tags
                if tag in weighted_tags
            )
            tag_score = min(matches / max(len(post_tags), 1), 1.0)

        category_score = weighted_categories.get(post_category, 0.0)

        return 0.6 * tag_score + 0.4 * category_score

    def _recency_score(self, post: Dict, now: datetime) -> float:
        """Exponential decay recency score (4-hour half-life)."""
        timestamp_str = (
            post.get("createdAt")
            or post.get("articleCreatedAt")
            or post.get("timestamp")
        )
        if not timestamp_str:
            # Treat missing timestamps as brand new
            return 1.0

        try:
            # Try ISO format or Unix timestamp
            if isinstance(timestamp_str, (int, float)):
                post_time = datetime.fromtimestamp(timestamp_str, tz=timezone.utc)
            else:
                # Try parsing ISO format
                try:
                    post_time = datetime.fromisoformat(
                        timestamp_str.replace("Z", "+00:00")
                    )
                except ValueError:
                    post_time = now
        except (ValueError, TypeError):
            post_time = now  # Fallback to current time

        hours_ago = max(0.0, (now - post_time).total_seconds() / 3600.0)
        return math.exp(-math.log(2) * hours_ago / RECENCY_HALF_LIFE_HOURS)

    def _importance_score(self, post: Dict) -> float:
        """Score based on likes/dislikes ratio."""
        likes = post.get("likes", 0)
        dislikes = post.get("dislikes", 0)
        total = likes + dislikes

        if total == 0:
            return 0.3  # Neutral default

        ratio = likes / total
        # Scale: 0.0 (all dislikes) to 1.0 (all likes)
        return ratio

    # ------------------------------------------------------------------
    # LLM brief generation
    # ------------------------------------------------------------------

    def _generate_brief_text(
        self, posts: List[Dict], language: str
    ) -> str:
        """Generate a human-readable news brief.

        Falls back to a plain headline list if the LLM is unavailable.
        """
        if not posts:
            return "No news to report."

        # Fallback: text-based headline list
        if not self.llm.is_available():
            logger.info("LLM unavailable for brief, using fallback")
            return self._generate_fallback_brief(posts, language)

        # LLM-generated brief
        headlines = "\n".join(
            f"- {p.get('title', 'Untitled')}"
            for p in posts
        )
        lang_instruction = (
            "Write the brief in Arabic."
            if language == "arabic"
            else "Write the brief in English."
        )

        prompt = (
            f"Generate a concise news brief with bold headlines and short summaries.\n"
            f"Here are the top stories:\n{headlines}\n\n"
            f"{lang_instruction}\n"
            f"Format: **Headline** followed by a 1-2 sentence summary."
        )

        logger.info("BRIEF GENERATION prompt (headlines count: %d, language: %s)", len(posts), language)

        try:
            result = self.llm.generate(
                prompt,
                temperature=settings.llm_temperature_brief,
            )
            logger.info("BRIEF GENERATION complete (%d chars)", len(result))
            return result
        except Exception as e:
            logger.warning("LLM brief generation failed: %s", e)
            return self._generate_fallback_brief(posts, language)

    # ------------------------------------------------------------------
    # Post translation
    # ------------------------------------------------------------------

    def _translate_posts(self, posts: List[Dict]) -> List[Dict]:
        """Translate post titles and summaries to Arabic using the LLM."""
        if not posts:
            return posts

        # Collect texts to translate
        texts_to_translate = []
        indices = []
        for i, post in enumerate(posts):
            title = post.get("title", "")
            if title:
                texts_to_translate.append(f"TITLE_{i}: {title}")
            summary = post.get("text", "") or post.get("content", "")
            if summary:
                # Truncate long summaries to keep translation prompt manageable
                truncated = summary[:300]
                texts_to_translate.append(f"SUMMARY_{i}: {truncated}")

        if not texts_to_translate:
            return posts

        prompt = (
            "Translate the following news titles and summaries from English to Arabic. "
            "Return ONLY the translations, one per line, keeping the same prefix format (TITLE_N: or SUMMARY_N:). "
            "Do not add any explanation.\n\n"
            + "\n".join(texts_to_translate)
        )

        try:
            result = self.llm.generate(prompt, temperature=0.3)
            # Parse translated lines
            translated_map = {}
            for line in result.strip().split("\n"):
                line = line.strip()
                if not line:
                    continue
                if line.startswith("TITLE_"):
                    key = line.split(":", 1)[0]  # e.g. TITLE_0
                    val = line.split(":", 1)[1].strip() if ":" in line else ""
                    translated_map[key] = val
                elif line.startswith("SUMMARY_"):
                    key = line.split(":", 1)[0]
                    val = line.split(":", 1)[1].strip() if ":" in line else ""
                    translated_map[key] = val

            # Apply translations back to posts
            for i, post in enumerate(posts):
                title_key = f"TITLE_{i}"
                summary_key = f"SUMMARY_{i}"
                if title_key in translated_map and translated_map[title_key]:
                    post["title"] = translated_map[title_key]
                if summary_key in translated_map and translated_map[summary_key]:
                    if post.get("text"):
                        post["text"] = translated_map[summary_key]
                    elif post.get("content"):
                        post["content"] = translated_map[summary_key]

            logger.info("Translated %d posts to Arabic", len(posts))
        except Exception as e:
            logger.warning("Post translation failed: %s — keeping original titles", e)

        return posts

    def _generate_fallback_brief(
        self, posts: List[Dict], language: str
    ) -> str:
        """Simple headline list when LLM is unavailable."""
        lang_prefix = "موجز الأخبار" if language == "arabic" else "News Brief"
        lines = [f"📰 **{lang_prefix}**\n"]
        for i, post in enumerate(posts[:10], 1):
            lines.append(f"{i}. {post.get('title', 'Untitled')}")
        return "\n".join(lines)
