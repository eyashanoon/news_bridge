from __future__ import annotations

import asyncio
import logging
import threading
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger("telegram_crawler")

try:
    from telethon import TelegramClient
    from telethon.tl.functions.contacts import SearchRequest
    from telethon.tl.types import MessageMediaPhoto, MessageMediaDocument
    _TELETHON = True
except ImportError:
    _TELETHON = False

_client: Any = None

# Telethon and uvicorn must NOT share an event loop.  Run Telethon in its own
# daemon thread with a dedicated asyncio loop.

_tg_loop: asyncio.AbstractEventLoop | None = None
_tg_thread: threading.Thread | None = None
_loop_ready = threading.Event()


def _run_loop(loop: asyncio.AbstractEventLoop) -> None:
    asyncio.set_event_loop(loop)
    _loop_ready.set()
    loop.run_forever()


def _get_loop() -> asyncio.AbstractEventLoop:
    global _tg_loop, _tg_thread
    if _tg_loop is not None and _tg_loop.is_running():
        return _tg_loop
    _loop_ready.clear()
    _tg_loop = asyncio.new_event_loop()
    _tg_thread = threading.Thread(
        target=_run_loop, args=(_tg_loop,), daemon=True, name="telethon-loop"
    )
    _tg_thread.start()
    _loop_ready.wait(timeout=5)
    return _tg_loop


def _run_sync(coro: Any, timeout: int = 30) -> Any:
    """Submit coro to the Telethon loop and block until complete."""
    future = asyncio.run_coroutine_threadsafe(coro, _get_loop())
    return future.result(timeout=timeout)


async def _run_from_uvicorn(coro: Any) -> Any:
    """Await a Telethon coroutine from inside a uvicorn async route handler."""
    cf = asyncio.run_coroutine_threadsafe(coro, _get_loop())
    return await asyncio.wrap_future(cf)


# -- Client lifecycle ----------------------------------------------------------

async def _init_async(api_id: int, api_hash: str, session_path: str) -> bool:
    global _client
    if not _TELETHON:
        logger.warning("telethon not installed. Run: pip install telethon")
        return False
    if not api_id or not api_hash:
        logger.info("TELEGRAM_API_ID/HASH not configured — web-scraping fallback active")
        return False
    try:
        c = TelegramClient(session_path, api_id, api_hash)
        await c.connect()
        if not await c.is_user_authorized():
            logger.warning("Telegram session not authorized. Run setup_session.py first.")
            await c.disconnect()
            return False
        _client = c
        me = await c.get_me()
        logger.info(
            "Telegram API ready — logged in as %s%s",
            me.first_name,
            f" (@{me.username})" if me.username else "",
        )
        return True
    except Exception as ex:
        logger.warning("Telegram API init failed: %s", ex)
        return False


def init(api_id: int, api_hash: str, session_path: str) -> bool:
    """Connect to Telegram. Sync-safe, called from on_startup."""
    try:
        return _run_sync(_init_async(api_id, api_hash, session_path), timeout=30)
    except Exception as ex:
        logger.warning("Telegram API init error: %s", ex)
        return False


async def _close_async() -> None:
    global _client
    if _client is not None:
        try:
            await _client.disconnect()
        except Exception:
            pass
        _client = None


def close() -> None:
    """Disconnect the client. Sync-safe, called from on_shutdown."""
    try:
        _run_sync(_close_async(), timeout=10)
    except Exception:
        pass


def is_ready() -> bool:
    return _client is not None


# -- Search --------------------------------------------------------------------

async def _search_async(query: str, limit: int) -> list[dict[str, Any]]:
    if _client is None:
        return []
    try:
        result = await _client(SearchRequest(q=query, limit=limit))
        out: list[dict[str, Any]] = []
        for entity in result.chats:
            username = getattr(entity, "username", None) or ""
            if not username:
                continue
            title = getattr(entity, "title", "") or username
            is_channel = getattr(entity, "broadcast", False)
            subs = getattr(entity, "participants_count", None)
            out.append({
                "username": username,
                "title": title,
                "description": "",
                "avatarUrl": None,
                "subscribers": subs,
                "hasPublicPreview": True,
                "type": "channel" if is_channel else "group",
            })
        return out
    except Exception as ex:
        logger.warning("Telegram API search error: %s", ex)
        return []


async def search(query: str, limit: int = 25) -> list[dict[str, Any]]:
    """Search Telegram channels. Awaitable from uvicorn async route handlers."""
    return await _run_from_uvicorn(_search_async(query, limit))


# -- Post fetching -------------------------------------------------------------

async def _fetch_posts_async(
    channel_username: str,
    since: datetime | None,
    limit: int,
) -> list[dict[str, Any]]:
    posts: list[dict[str, Any]] = []
    try:
        async for message in _client.iter_messages(channel_username, limit=limit):
            if not message.text and not message.media:
                continue
            msg_date = message.date.astimezone(timezone.utc)
            if since and msg_date <= since:
                break

            media_type: str | None = None
            if _TELETHON and message.media is not None:
                if isinstance(message.media, MessageMediaPhoto):
                    media_type = "photo"
                elif isinstance(message.media, MessageMediaDocument):
                    doc = message.media.document
                    mime = getattr(doc, "mime_type", "") or ""
                    media_type = "video" if mime.startswith("video/") else "document"

            posts.append({
                "telegramMessageId": message.id,
                "content": message.text or "",
                "mediaUrl": None,
                "mediaType": media_type,
                "messageDate": msg_date.isoformat(),
                "viewCount": message.views or 0,
                "edited": message.edit_date is not None,
            })
    except Exception as ex:
        logger.warning("MTProto fetch_posts failed for @%s: %s", channel_username, ex)
    return posts


def fetch_posts(
    channel_username: str,
    since: datetime | None = None,
    limit: int = 100,
) -> list[dict[str, Any]] | None:
    """Fetch posts synchronously from a background thread.

    Returns None if the client is not ready so the caller falls back to
    web scraping. Returns an empty list when there are no new posts.
    """
    if _client is None:
        logger.warning("fetch_posts: client not ready — falling back to scraper")
        return None
    try:
        return _run_sync(_fetch_posts_async(channel_username, since, limit), timeout=60)
    except Exception as ex:
        logger.warning("fetch_posts error for @%s: %s", channel_username, ex)
        return None
