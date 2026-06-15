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
    max_posts_per_channel: int
    request_timeout_seconds: int
    telegram_api_id: int
    telegram_api_hash: str
    telegram_session_path: str
    num_workers: int
    score_alpha: float
    staleness_weight: float
    min_cooldown_seconds: int
    channel_reload_seconds: int
    # Legacy — kept for .env compatibility
    crawl_interval_minutes: int


settings = Settings(
    backend_base_url=os.getenv("BACKEND_BASE_URL", "http://localhost:8080").rstrip("/"),
    backend_email=os.getenv("BACKEND_EMAIL", "telegram-crawler@news.local"),
    backend_password=os.getenv("BACKEND_PASSWORD", "secure-telegram-password-change-me"),
    max_posts_per_channel=int(os.getenv("TELEGRAM_MAX_POSTS_PER_CHANNEL", "100")),
    request_timeout_seconds=int(os.getenv("REQUEST_TIMEOUT_SECONDS", "30")),
    telegram_api_id=int(os.getenv("TELEGRAM_API_ID", "0")),
    telegram_api_hash=os.getenv("TELEGRAM_API_HASH", ""),
    telegram_session_path=os.getenv("TELEGRAM_SESSION_PATH", "telegram_session"),
    num_workers=int(os.getenv("TELEGRAM_NUM_WORKERS", "3")),
    score_alpha=float(os.getenv("TELEGRAM_SCORE_ALPHA", "0.3")),
    staleness_weight=float(os.getenv("TELEGRAM_STALENESS_WEIGHT", "5.0")),
    min_cooldown_seconds=int(os.getenv(
        "TELEGRAM_MIN_COOLDOWN_SECONDS",
        str(int(os.getenv("TELEGRAM_CRAWL_INTERVAL_MINUTES", "10")) * 60),
    )),
    channel_reload_seconds=int(os.getenv("TELEGRAM_CHANNEL_RELOAD_SECONDS", "120")),
    crawl_interval_minutes=int(os.getenv("TELEGRAM_CRAWL_INTERVAL_MINUTES", "10")),
)
