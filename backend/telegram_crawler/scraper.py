from __future__ import annotations

import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Any, Optional

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger("telegram_crawler")


def search_channels(query: str, timeout: int = 15) -> list[dict[str, Any]]:
    """Validate Telegram channel usernames by checking t.me/{username}.
    Accepts a space/comma-separated list of usernames to check multiple at once.
    Returns a list of found channels with metadata extracted from page meta tags."""
    raw = query.strip()
    if not raw:
        return []

    # Split on spaces or commas so the user can search multiple names at once
    tokens = [t.strip().lstrip("@")
                .replace("https://t.me/", "")
                .replace("http://t.me/", "")
                .replace("t.me/", "")
              for t in re.split(r"[\s,]+", raw) if t.strip()]

    headers = {
        "User-Agent": "TelegramBot (like TwitterBot)",
        "Accept-Language": "en-US,en;q=0.9",
    }
    results: list[dict[str, Any]] = []
    seen: set[str] = set()

    for username in tokens[:5]:  # cap at 5 per query
        if not username or username.lower() in seen:
            continue
        seen.add(username.lower())
        try:
            resp = requests.get(f"https://t.me/{username}", headers=headers, timeout=timeout)
            if resp.status_code != 200:
                continue

            soup = BeautifulSoup(resp.text, "html.parser")

            # Telegram returns a valid resolve URL in meta if the channel exists
            resolve_meta = soup.find("meta", attrs={"property": "al:ios:url"})
            if not resolve_meta:
                continue
            resolve_url = resolve_meta.get("content", "")
            if "resolve" not in resolve_url and "joinchat" not in resolve_url:
                continue

            # Extract display name from og:title ("Telegram: Contact @username" or just the name)
            og_title_el = soup.find("meta", attrs={"property": "og:title"})
            og_title = og_title_el["content"] if og_title_el else ""
            # Strip the Telegram wrapper prefix if present
            display_name = og_title
            for prefix in ("Telegram: Contact @", "Telegram: ", "Contact @"):
                if display_name.startswith(prefix):
                    display_name = display_name[len(prefix):]
                    break

            # Description
            og_desc_el = soup.find("meta", attrs={"property": "og:description"})
            description = (og_desc_el["content"] if og_desc_el else "") or ""

            # Avatar image
            og_img_el = soup.find("meta", attrs={"property": "og:image"})
            avatar_url = og_img_el["content"] if og_img_el else None
            # Skip generic telegram logo
            if avatar_url and "t_logo" in avatar_url:
                avatar_url = None

            results.append({
                "username": username,
                "title": display_name or username,
                "description": description,
                "avatarUrl": avatar_url,
                "subscribers": None,
            })
        except Exception as ex:
            logger.debug(f"Channel lookup for '{username}' failed: {ex}")
            continue

    return results


def scrape_channel(
    channel_username: str,
    max_posts: int = 50,
    timeout: int = 30,
    since: Optional[datetime] = None,
) -> list[dict[str, Any]]:
    """Scrape recent posts from a public Telegram channel via t.me/s/ web preview.
    If `since` is provided, only return posts newer than that datetime."""
    url = f"https://t.me/s/{channel_username}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }

    try:
        resp = requests.get(url, headers=headers, timeout=timeout)
        resp.raise_for_status()
    except Exception as ex:
        logger.error(f"Failed to fetch channel @{channel_username}: {ex}")
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    message_divs = soup.select(".tgme_widget_message_wrap")

    posts: list[dict[str, Any]] = []

    for div in message_divs[-max_posts:]:
        try:
            msg_widget = div.select_one(".tgme_widget_message")
            if not msg_widget:
                continue

            data_post = msg_widget.get("data-post", "")
            parts = data_post.split("/")
            if len(parts) < 2:
                continue
            try:
                msg_id = int(parts[-1])
            except ValueError:
                continue

            # Content text
            text_el = msg_widget.select_one(".tgme_widget_message_text")
            content = text_el.get_text(separator="\n", strip=True) if text_el else ""

            # Media
            media_url = None
            media_type = None

            photo_el = msg_widget.select_one(".tgme_widget_message_photo_wrap")
            if photo_el:
                style = photo_el.get("style", "")
                m = re.search(r"url\(['\"]?(.*?)['\"]?\)", style)
                if m:
                    media_url = m.group(1)
                    media_type = "photo"

            video_el = msg_widget.select_one("video")
            if video_el:
                media_url = video_el.get("src")
                media_type = "video"

            # Date
            date_el = msg_widget.select_one("time[datetime]")
            msg_date = None
            msg_dt = None
            if date_el:
                try:
                    msg_dt = datetime.fromisoformat(
                        date_el["datetime"].replace("Z", "+00:00")
                    ).astimezone(timezone.utc)
                    msg_date = msg_dt.isoformat()
                except Exception:
                    pass

            # Skip posts older than the `since` cutoff
            if since and msg_dt and msg_dt <= since:
                continue

            # Views
            views_el = msg_widget.select_one(".tgme_widget_message_views")
            view_count = 0
            if views_el:
                raw = views_el.get_text(strip=True).upper().replace(",", "")
                try:
                    if raw.endswith("K"):
                        view_count = int(float(raw[:-1]) * 1000)
                    elif raw.endswith("M"):
                        view_count = int(float(raw[:-1]) * 1000000)
                    else:
                        view_count = int(raw)
                except ValueError:
                    pass

            posts.append({
                "telegramMessageId": msg_id,
                "content": content,
                "mediaUrl": media_url,
                "mediaType": media_type,
                "messageDate": msg_date,
                "viewCount": view_count,
                "edited": False,
            })

        except Exception as ex:
            logger.warning(f"Error parsing message in @{channel_username}: {ex}")
            continue

    logger.info(f"Scraped {len(posts)} posts from @{channel_username}")
    return posts
