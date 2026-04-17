from __future__ import annotations

import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    backend_base_url: str
    backend_email: str
    backend_password: str
    crawl_interval_minutes: int
    max_posts_per_channel: int
    request_timeout_seconds: int


settings = Settings(
    backend_base_url=os.getenv("BACKEND_BASE_URL", "http://localhost:8080").rstrip("/"),
    backend_email=os.getenv("BACKEND_EMAIL", "telegram-crawler@news.local"),
    backend_password=os.getenv("BACKEND_PASSWORD", "secure-telegram-password-change-me"),
    crawl_interval_minutes=int(os.getenv("TELEGRAM_CRAWL_INTERVAL_MINUTES", "10")),
    max_posts_per_channel=int(os.getenv("TELEGRAM_MAX_POSTS_PER_CHANNEL", "50")),
    request_timeout_seconds=int(os.getenv("REQUEST_TIMEOUT_SECONDS", "30")),
)
