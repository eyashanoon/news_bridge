"""Per-channel Telegram crawl logic (MTProto + web scraper fallback)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Callable

import telegram_client
from backend_client import BackendClient
from scraper import scrape_channel
from settings import settings

logger = logging.getLogger("telegram_crawler")


class ChannelCrawlService:
    """Crawls a single Telegram channel — preserves MTProto + scraper fallback."""

    def __init__(
        self,
        backend: BackendClient,
        log_fn: Callable[[str, str], None] | None = None,
    ) -> None:
        self._backend = backend
        self._log = log_fn or (lambda level, msg: logger.log(
            getattr(logging, level, logging.INFO), msg
        ))

    def crawl_channel(self, channel: dict[str, Any]) -> dict[str, Any]:
        """
        Crawl one channel. Returns stats dict:
        {posts_scraped, posts_created, posts_skipped, errors, avg_view_count}
        """
        username = channel.get("channelUsername", "")
        channel_id = channel.get("id")
        last_crawled = channel.get("lastCrawledAt")

        since_dt = None
        if last_crawled:
            try:
                since_dt = datetime.fromisoformat(
                    last_crawled.replace("Z", "+00:00")
                ).astimezone(timezone.utc)
            except Exception:
                since_dt = datetime.now(timezone.utc) - timedelta(minutes=3)
        else:
            since_dt = datetime.now(timezone.utc) - timedelta(minutes=3)

        posts = telegram_client.fetch_posts(
            username,
            since=None,
            limit=settings.max_posts_per_channel,
        )
        if posts is None:
            self._log("INFO", f"  Using web scraper for @{username}")
            posts = scrape_channel(
                username,
                max_posts=settings.max_posts_per_channel,
                timeout=settings.request_timeout_seconds,
                since=since_dt,
            )
        else:
            self._log("INFO", f"  MTProto @{username}: {len(posts)} posts")

        if not posts:
            return {
                "posts_scraped": 0,
                "posts_created": 0,
                "posts_skipped": 0,
                "errors": 0,
                "avg_view_count": 0.0,
            }

        for p in posts:
            p["channelId"] = channel_id

        avg_views = _avg_view_count(posts)
        created = skipped = errors = 0

        try:
            result = self._backend.bulk_create_posts(posts)
            created = result.get("created", 0)
            skipped = result.get("skipped", 0)
            errors = len(result.get("errors", []))
            self._backend.update_crawl_stats(channel_id, created, avg_views)
        except Exception as ex:
            self._log("ERROR", f"Failed to push posts for @{username}: {ex}")
            errors = 1

        return {
            "posts_scraped": len(posts),
            "posts_created": created,
            "posts_skipped": skipped,
            "errors": errors,
            "avg_view_count": avg_views,
        }


def _avg_view_count(posts: list[dict]) -> float:
    views = [p.get("viewCount") or 0 for p in posts if p.get("viewCount")]
    return sum(views) / len(views) if views else 0.0
