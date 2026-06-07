import logging

logger = logging.getLogger(__name__)


def fetch_html(url: str) -> str | None:
    try:
        from web_fetch import fetch_html as _fetch

        result = _fetch(url, profile="news", timeout=30, allow_browser=True)
        if result.ok:
            return result.html
        logger.warning(
            "Fetch failed for %s: %s (HTTP %s via %s)",
            url,
            result.error or "blocked or empty page",
            result.status_code,
            result.method,
        )
        return None
    except Exception as exc:
        logger.warning("Request failed for %s: %s", url, exc)
        return None
