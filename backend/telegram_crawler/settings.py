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
    telegram_api_id: int
    telegram_api_hash: str
    telegram_session_path: str


settings = Settings(
    backend_base_url=os.getenv("BACKEND_BASE_URL", "http://localhost:8080").rstrip("/"),
    backend_email=os.getenv("BACKEND_EMAIL", "telegram-crawler@news.local"),
    backend_password=os.getenv("BACKEND_PASSWORD", "secure-telegram-password-change-me"),
    crawl_interval_minutes=int(os.getenv("TELEGRAM_CRAWL_INTERVAL_MINUTES", "10")),
    max_posts_per_channel=int(os.getenv("TELEGRAM_MAX_POSTS_PER_CHANNEL", "100")),
    request_timeout_seconds=int(os.getenv("REQUEST_TIMEOUT_SECONDS", "30")),
    telegram_api_id=int(os.getenv("TELEGRAM_API_ID", "0")),
    telegram_api_hash=os.getenv("TELEGRAM_API_HASH", ""),
    telegram_session_path=os.getenv("TELEGRAM_SESSION_PATH", "telegram_session"),
)
