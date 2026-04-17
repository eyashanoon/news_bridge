import requests
import logging

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}

logger = logging.getLogger(__name__)

def fetch_html(url):
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        if response.status_code == 200:
            return response.text
        else:
            logger.warning("Non-200 response for %s: %s", url, response.status_code)
            return None
    except requests.RequestException as exc:
        logger.warning("Request failed for %s: %s", url, exc)
        return None