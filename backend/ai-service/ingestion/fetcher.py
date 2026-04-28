import requests
from config import BACKEND_BASE_URL, BACKEND_TOKEN


def get_headers():
    return {"Authorization": f"Bearer {BACKEND_TOKEN}"}


def fetch_posts_by_tags(tags: list[str]):
    url = f"{BACKEND_BASE_URL}/posts/by-tags"
    params = [("tags", tag) for tag in tags]

    res = requests.get(url, headers=get_headers(), params=params)
    res.raise_for_status()
    return res.json()


def fetch_post_content(post_id: int):
    url = f"{BACKEND_BASE_URL}/posts/{post_id}/content"

    res = requests.get(url, headers=get_headers())
    res.raise_for_status()
    return res.json()
