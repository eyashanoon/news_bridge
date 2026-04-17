from __future__ import annotations

import os
from dataclasses import dataclass
from dotenv import load_dotenv


load_dotenv()


def _get_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    backend_base_url: str
    backend_email: str
    backend_password: str
    crawler_interval_minutes: int
    crawler_max_links_per_listing: int
    crawler_request_timeout_seconds: int
    crawler_restrict_same_domain: bool
    vv_py_path: str | None


settings = Settings(
    backend_base_url=os.getenv("BACKEND_BASE_URL", "http://localhost:8080").rstrip("/"),
    backend_email=os.getenv("BACKEND_EMAIL", "crawler-service@news.local"),
    backend_password=os.getenv("BACKEND_PASSWORD", "secure-crawler-password-change-me"),
    crawler_interval_minutes=int(os.getenv("CRAWLER_INTERVAL_MINUTES", "5")),
    crawler_max_links_per_listing=int(os.getenv("CRAWLER_MAX_LINKS_PER_LISTING", "150")),
    crawler_request_timeout_seconds=int(os.getenv("CRAWLER_REQUEST_TIMEOUT_SECONDS", "30")),
    crawler_restrict_same_domain=_get_bool("CRAWLER_RESTRICT_SAME_DOMAIN", True),
    vv_py_path=os.getenv("VV_PY_PATH") or None,
)
