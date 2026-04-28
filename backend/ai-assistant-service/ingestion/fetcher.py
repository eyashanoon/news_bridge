import requests
from config import BACKEND_BASE_URL, BACKEND_TOKEN

headers = {"Authorization": f"Bearer {BACKEND_TOKEN}"}


def fetch_posts_by_tags(tags):
    res = requests.get(
        f"{BACKEND_BASE_URL}/posts/by-tags",
        headers=headers,
        params=[("tags", t) for t in tags]
    )
    res.raise_for_status()
    return res.json()


def fetch_post_content(post_id):
    res = requests.get(
        f"{BACKEND_BASE_URL}/posts/{post_id}/content",
        headers=headers
    )
    res.raise_for_status()
    return res.json()