from __future__ import annotations

import collections
import logging
import threading
from datetime import datetime, timezone, timedelta
from threading import Lock
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from backend_client import BackendClient
from scraper import scrape_channel, search_channels
from settings import settings

# ─── Log buffer ──────────────────────────────────────────────────────────────
_LOG_MAX = 500
_log_buffer: collections.deque[dict] = collections.deque(maxlen=_LOG_MAX)
_log_lock = Lock()


def _push_log(level: str, message: str) -> None:
    entry = {"ts": datetime.utcnow().isoformat(), "level": level, "msg": message}
    with _log_lock:
        _log_buffer.append(entry)


class _DequeHandler(logging.Handler):
    def emit(self, record: logging.LogRecord) -> None:
        _push_log(record.levelname, self.format(record))


_handler = _DequeHandler()
_handler.setFormatter(logging.Formatter("%(message)s"))
logging.getLogger("telegram_crawler").addHandler(_handler)
logging.getLogger("telegram_crawler").setLevel(logging.DEBUG)
logger = logging.getLogger("telegram_crawler")

# ─── Mutable interval ────────────────────────────────────────────────────────
_interval_minutes: int = settings.crawl_interval_minutes
_interval_lock = Lock()

# ─── App + state ─────────────────────────────────────────────────────────────
app = FastAPI(title="Telegram Crawler Server", version="1.0.0")
_lock = Lock()
_last_run: dict | None = None
_run_status: dict = {"running": False}

backend = BackendClient(
    base_url=settings.backend_base_url,
    email=settings.backend_email,
    password=settings.backend_password,
    timeout=settings.request_timeout_seconds,
)

scheduler = BackgroundScheduler(timezone="UTC")


def _get_scheduler_status() -> dict:
    global _interval_minutes
    job = scheduler.get_job("telegram-crawl-cycle") if scheduler.running else None
    is_paused = job is None or job.next_run_time is None
    next_run = None if is_paused else job.next_run_time.isoformat()
    with _interval_lock:
        interval = _interval_minutes
    return {
        "schedulerRunning": scheduler.running,
        "paused": is_paused,
        "intervalMinutes": interval,
        "nextRunAt": next_run,
    }


def _run_cycle() -> None:
    global _last_run, _run_status
    if _lock.locked():
        return
    with _lock:
        started = datetime.utcnow().isoformat()
        _last_run = {"startedAt": started, "status": "running"}
        _run_status = {"running": True}
        _push_log("INFO", f"=== Telegram crawl cycle started at {started} ===")

        total_channels = 0
        total_scraped = 0
        total_created = 0
        total_skipped = 0
        total_errors = 0

        try:
            channels = backend.get_active_channels()
            total_channels = len(channels)
            _push_log("INFO", f"Found {total_channels} active Telegram channel(s)")

            for ch in channels:
                username = ch.get("channelUsername", "")
                channel_id = ch.get("id")
                last_crawled = ch.get("lastCrawledAt")
                _push_log("INFO", f"Scraping @{username} (id={channel_id})...")

                # Determine the time cutoff for this channel:
                # - If previously crawled, use lastCrawledAt
                # - If never crawled, use 3 minutes ago
                since_dt = None
                if last_crawled:
                    try:
                        since_dt = datetime.fromisoformat(
                            last_crawled.replace("Z", "+00:00")
                        ).astimezone(timezone.utc)
                        _push_log("INFO", f"  Fetching posts since {since_dt.isoformat()}")
                    except Exception:
                        since_dt = datetime.now(timezone.utc) - timedelta(minutes=3)
                else:
                    since_dt = datetime.now(timezone.utc) - timedelta(minutes=3)
                    _push_log("INFO", f"  First crawl — fetching posts from last 3 minutes")

                posts = scrape_channel(
                    username,
                    max_posts=settings.max_posts_per_channel,
                    timeout=settings.request_timeout_seconds,
                    since=since_dt,
                )
                total_scraped += len(posts)

                if not posts:
                    _push_log("WARN", f"No posts scraped from @{username}")
                    continue

                # Attach channelId
                for p in posts:
                    p["channelId"] = channel_id

                try:
                    result = backend.bulk_create_posts(posts)
                    created = result.get("created", 0)
                    skipped = result.get("skipped", 0)
                    errors = result.get("errors", [])
                    total_created += created
                    total_skipped += skipped
                    total_errors += len(errors)
                    _push_log("INFO",
                              f"@{username}: {created} created, {skipped} skipped, {len(errors)} errors")
                    for err in errors[:5]:
                        _push_log("WARN", f"  {err}")
                except Exception as ex:
                    total_errors += 1
                    _push_log("ERROR", f"Failed to push posts for @{username}: {ex}")

            finished = datetime.utcnow().isoformat()
            _last_run = {
                "status": "success",
                "startedAt": started,
                "finishedAt": finished,
                "channelsProcessed": total_channels,
                "postsScraped": total_scraped,
                "postsCreated": total_created,
                "postsSkipped": total_skipped,
                "errors": total_errors,
            }
            _push_log("INFO",
                       f"=== Cycle finished: {total_created} created, "
                       f"{total_skipped} skipped, {total_errors} errors ===")

        except Exception as ex:
            _last_run = {
                "status": "failed",
                "startedAt": started,
                "finishedAt": datetime.utcnow().isoformat(),
                "error": str(ex),
            }
            _push_log("ERROR", f"=== Cycle FAILED: {ex} ===")
        finally:
            _run_status = {"running": False}


# ─── Lifecycle ────────────────────────────────────────────────────────────────
@app.on_event("startup")
def on_startup() -> None:
    _push_log("INFO", "Telegram crawler server started")
    scheduler.add_job(
        _run_cycle,
        "interval",
        minutes=_interval_minutes,
        id="telegram-crawl-cycle",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()


@app.on_event("shutdown")
def on_shutdown() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)


# ─── Health / Status ─────────────────────────────────────────────────────────
@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        **_get_scheduler_status(),
        "crawlRunning": _run_status["running"],
        "backendBaseUrl": settings.backend_base_url,
    }


@app.post("/run-now")
def run_now() -> dict:
    if _lock.locked():
        raise HTTPException(status_code=409, detail="Crawl already in progress")
    t = threading.Thread(target=_run_cycle, daemon=True)
    t.start()
    return {"ok": True, "message": "Telegram crawl cycle started in background"}


@app.get("/last-run")
def last_run() -> dict:
    return _last_run or {"status": "never-run"}


@app.get("/search")
def search(q: str = "") -> dict:
    """Search for Telegram channels by name/username."""
    if not q or len(q.strip()) < 2:
        return {"results": []}
    try:
        channels_found = search_channels(q.strip(), timeout=settings.request_timeout_seconds)
        return {"results": channels_found}
    except Exception as ex:
        logger.error(f"Channel search failed: {ex}")
        return {"results": [], "error": str(ex)}


@app.get("/control/status")
def scheduler_status() -> dict:
    return {
        **_get_scheduler_status(),
        "crawlRunning": _run_status["running"],
        "lastRun": _last_run or {"status": "never-run"},
    }


@app.post("/control/start")
def start_scheduler() -> dict:
    if not scheduler.running:
        raise HTTPException(status_code=503, detail="Scheduler not initialized")
    try:
        scheduler.resume_job("telegram-crawl-cycle")
        _push_log("INFO", "Scheduler resumed by admin")
    except Exception as ex:
        raise HTTPException(status_code=500, detail=str(ex))
    return {"ok": True, "message": "Scheduler started", **_get_scheduler_status()}


@app.post("/control/stop")
def stop_scheduler() -> dict:
    if not scheduler.running:
        raise HTTPException(status_code=503, detail="Scheduler not initialized")
    try:
        scheduler.pause_job("telegram-crawl-cycle")
        _push_log("INFO", "Scheduler paused by admin")
    except Exception as ex:
        raise HTTPException(status_code=500, detail=str(ex))
    return {"ok": True, "message": "Scheduler stopped", **_get_scheduler_status()}


# ─── Logs ─────────────────────────────────────────────────────────────────────
@app.get("/logs")
def get_logs(since: Optional[str] = None, limit: int = 200) -> dict:
    with _log_lock:
        entries = list(_log_buffer)
    if since:
        entries = [e for e in entries if e["ts"] > since]
    return {"logs": entries[-limit:], "total": len(entries)}


@app.delete("/logs")
def clear_logs() -> dict:
    with _log_lock:
        _log_buffer.clear()
    return {"ok": True}


# ─── Interval ─────────────────────────────────────────────────────────────────
class IntervalRequest(BaseModel):
    minutes: int


@app.post("/control/interval")
def set_interval(body: IntervalRequest) -> dict:
    global _interval_minutes
    if body.minutes < 1 or body.minutes > 1440:
        raise HTTPException(status_code=400, detail="Interval must be 1–1440 minutes")
    with _interval_lock:
        _interval_minutes = body.minutes
    if scheduler.running:
        job = scheduler.get_job("telegram-crawl-cycle")
        if job:
            scheduler.reschedule_job("telegram-crawl-cycle", trigger="interval", minutes=body.minutes)
    _push_log("INFO", f"Crawl interval changed to {body.minutes} minute(s)")
    return {"ok": True, "intervalMinutes": body.minutes, **_get_scheduler_status()}
