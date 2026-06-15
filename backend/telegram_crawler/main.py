from __future__ import annotations

import asyncio
import collections
import logging
import threading
import time
from datetime import datetime
from threading import Lock
from typing import Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

import telegram_client
from backend_client import BackendClient
from channel_scheduler import ChannelScheduler
from crawler_service import ChannelCrawlService
from scraper import search_channels
from settings import settings

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

app = FastAPI(title="Telegram Crawler Server", version="2.0.0")

backend = BackendClient(
    base_url=settings.backend_base_url,
    email=settings.backend_email,
    password=settings.backend_password,
    timeout=settings.request_timeout_seconds,
)

crawl_service = ChannelCrawlService(backend, log_fn=_push_log)

_scheduler = ChannelScheduler(
    service=crawl_service,
    backend=backend,
    num_workers=settings.num_workers,
    score_alpha=settings.score_alpha,
    staleness_weight=settings.staleness_weight,
    min_cooldown_seconds=settings.min_cooldown_seconds,
    log_fn=_push_log,
)

_reload_stop = threading.Event()
_reload_thread: threading.Thread | None = None

_last_run: dict | None = None
_scheduler_started = False


@app.on_event("startup")
async def on_startup() -> None:
    global _scheduler_started, _reload_thread
    _push_log("INFO", "Telegram crawler server v2 started (worker-based scheduler)")
    telegram_client.init(
        settings.telegram_api_id,
        settings.telegram_api_hash,
        settings.telegram_session_path,
    )
    _scheduler.load_channels()
    _scheduler.start()
    _scheduler_started = True

    def _periodic_reload() -> None:
        while not _reload_stop.wait(settings.channel_reload_seconds):
            try:
                _scheduler.reload_channels()
            except Exception as ex:
                _push_log("WARN", f"Periodic channel reload failed: {ex}")

    _reload_thread = threading.Thread(target=_periodic_reload, daemon=True, name="tg-reload")
    _reload_thread.start()
    _push_log(
        "INFO",
        f"Cooldown={settings.min_cooldown_seconds}s | "
        f"workers={settings.num_workers} | reload every {settings.channel_reload_seconds}s",
    )


@app.on_event("shutdown")
async def on_shutdown() -> None:
    _reload_stop.set()
    _scheduler.stop()
    telegram_client.close()


@app.get("/health")
def health() -> dict:
    status = _scheduler.get_status()
    return {
        "ok": True,
        "schedulerRunning": _scheduler_started and not status.get("stopped"),
        "paused": status.get("paused", False),
        "numWorkers": settings.num_workers,
        "backendBaseUrl": settings.backend_base_url,
        "telegramApiReady": telegram_client.is_ready(),
        "minCooldownSeconds": settings.min_cooldown_seconds,
        "numWorkers": settings.num_workers,
        **status,
    }


@app.post("/run-now")
def run_now() -> dict:
    count = _scheduler.trigger_run_now()
    return {"ok": True, "message": f"Triggered crawl for {count} channel(s)"}


@app.get("/last-run")
def last_run() -> dict:
    return _last_run or {"status": "continuous-scheduler"}


@app.get("/search")
async def search(q: str = "") -> dict:
    _push_log("INFO", f"[search] q={repr(q)}")
    if not q or len(q.strip()) < 2:
        return {"results": []}
    q = q.strip()

    if telegram_client.is_ready():
        results = await telegram_client.search(q)
        if results:
            return {"results": results}

    try:
        results = await asyncio.to_thread(
            search_channels, q, settings.request_timeout_seconds
        )
        return {"results": results}
    except Exception as ex:
        logger.error(f"Channel search failed: {ex}")
        return {"results": [], "error": str(ex)}


@app.get("/control/status")
def scheduler_status() -> dict:
    return {
        "schedulerRunning": _scheduler_started,
        **_scheduler.get_status(),
        "lastRun": _last_run or {"status": "continuous-scheduler"},
    }


@app.post("/control/start")
def start_scheduler() -> dict:
    _scheduler.resume()
    _push_log("INFO", "Scheduler resumed by admin")
    return {"ok": True, "message": "Scheduler started", **_scheduler.get_status()}


@app.post("/control/stop")
def stop_scheduler() -> dict:
    _scheduler.pause()
    _push_log("INFO", "Scheduler paused by admin")
    return {"ok": True, "message": "Scheduler stopped", **_scheduler.get_status()}


@app.post("/control/restart")
def restart_scheduler() -> dict:
    _scheduler.restart()
    _push_log("INFO", "Scheduler restarted by admin")
    return {"ok": True, "message": "Scheduler restarted", **_scheduler.get_status()}


@app.post("/control/reload")
def reload_channels() -> dict:
    _scheduler.reload_channels()
    return {"ok": True, **_scheduler.get_status()}


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


class IntervalRequest(BaseModel):
    minutes: int


class StalenessRequest(BaseModel):
    weight: float


@app.post("/control/interval")
def set_interval(body: IntervalRequest) -> dict:
    """Set minimum cooldown between crawls of the same channel (minutes)."""
    if body.minutes < 1 or body.minutes > 1440:
        raise HTTPException(status_code=400, detail="Interval must be 1–1440 minutes")
    _scheduler._min_cooldown = float(body.minutes * 60)
    _scheduler._staleness_weight = body.minutes / 10.0
    _push_log("INFO", f"Min channel cooldown set to {body.minutes} minute(s)")
    return {
        "ok": True,
        "minCooldownSeconds": _scheduler._min_cooldown,
        "stalenessWeight": _scheduler._staleness_weight,
    }


@app.post("/control/staleness")
def set_staleness(body: StalenessRequest) -> dict:
    if body.weight < 0.1 or body.weight > 20.0:
        raise HTTPException(status_code=400, detail="Weight must be 0.1–20.0")
    _scheduler._staleness_weight = body.weight
    return {"ok": True, "stalenessWeight": body.weight}
