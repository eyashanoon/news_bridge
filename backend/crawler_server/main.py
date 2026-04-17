from __future__ import annotations

import collections
import logging
import threading
from datetime import datetime
from pathlib import Path
import sys
from threading import Lock
from typing import Optional
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# Ensure backend root is importable when running from crawler_server directory.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from backend_client import BackendClient
from crawler_service import CrawlerService
from settings import settings
from extractor import extract_article
from checker import is_article

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
        level = record.levelname
        _push_log(level, self.format(record))


_handler = _DequeHandler()
_handler.setFormatter(logging.Formatter("%(message)s"))
logging.getLogger("crawler").addHandler(_handler)
logging.getLogger("crawler").setLevel(logging.DEBUG)

crawler_logger = logging.getLogger("crawler")

# ─── Mutable interval (settable at runtime) ───────────────────────────────────
_interval_minutes: int = settings.crawler_interval_minutes
_interval_lock = Lock()

# ─── App + state ─────────────────────────────────────────────────────────────
app = FastAPI(title="News Collector Server", version="1.0.0")
_lock = Lock()
_last_run: dict | None = None
_run_status: dict = {"running": False, "liveStats": None}

backend = BackendClient(
    base_url=settings.backend_base_url,
    email=settings.backend_email,
    password=settings.backend_password,
    timeout_seconds=settings.crawler_request_timeout_seconds,
)


def _make_service() -> CrawlerService:
    return CrawlerService(
        backend=backend,
        is_article_fn=is_article,
        extract_article_fn=extract_article,
        log_fn=crawler_logger.info,
    )


service = _make_service()
scheduler = BackgroundScheduler(timezone="UTC")


def _get_scheduler_status() -> dict:
    global _interval_minutes
    job = scheduler.get_job("news-crawl-cycle") if scheduler.running else None
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
        return  # already running; skip
    with _lock:
        started = datetime.utcnow().isoformat()
        _last_run = {"startedAt": started, "status": "running"}
        _run_status = {"running": True, "liveStats": None}
        _push_log("INFO", f"=== Crawl cycle started at {started} ===")
        try:
            result = service.run_once()
            _last_run = {"status": "success", **result}
            _push_log("INFO", f"=== Cycle finished: {result.get('articlesCreated',0)} articles, "
                              f"{result.get('cacheHits',0)} cache hits, {result.get('failed',0)} failed ===")
        except Exception as ex:
            _last_run = {
                "status": "failed",
                "error": str(ex),
                "finishedAt": datetime.utcnow().isoformat(),
            }
            _push_log("ERROR", f"=== Cycle FAILED: {ex} ===")
        finally:
            _run_status = {"running": False, "liveStats": None}


@app.on_event("startup")
def on_startup() -> None:
    global _interval_minutes
    _push_log("INFO", "Crawler server started")
    scheduler.add_job(
        _run_cycle,
        "interval",
        minutes=_interval_minutes,
        id="news-crawl-cycle",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()


@app.on_event("shutdown")
def on_shutdown() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)


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
        raise HTTPException(status_code=409, detail="Crawler run already in progress")
    t = threading.Thread(target=_run_cycle, daemon=True)
    t.start()
    return {"ok": True, "message": "Crawl cycle started in background"}


@app.get("/last-run")
def last_run() -> dict:
    return _last_run or {"status": "never-run"}


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
        raise HTTPException(status_code=503, detail="Scheduler is not initialized")
    try:
        scheduler.resume_job("news-crawl-cycle")
        _push_log("INFO", "Scheduler resumed by admin")
    except Exception as ex:
        raise HTTPException(status_code=500, detail=f"Failed to start crawler scheduler: {ex}")
    return {"ok": True, "message": "Crawler scheduler started", **_get_scheduler_status()}


@app.post("/control/stop")
def stop_scheduler() -> dict:
    if not scheduler.running:
        raise HTTPException(status_code=503, detail="Scheduler is not initialized")
    try:
        scheduler.pause_job("news-crawl-cycle")
        _push_log("INFO", "Scheduler paused by admin")
    except Exception as ex:
        raise HTTPException(status_code=500, detail=f"Failed to stop crawler scheduler: {ex}")
    return {"ok": True, "message": "Crawler scheduler stopped", **_get_scheduler_status()}


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
        raise HTTPException(status_code=400, detail="Interval must be between 1 and 1440 minutes")
    with _interval_lock:
        _interval_minutes = body.minutes
    if scheduler.running:
        job = scheduler.get_job("news-crawl-cycle")
        if job:
            scheduler.reschedule_job(
                "news-crawl-cycle",
                trigger="interval",
                minutes=body.minutes,
            )
    _push_log("INFO", f"Crawl interval changed to {body.minutes} minute(s) by admin")
    return {"ok": True, "intervalMinutes": body.minutes, **_get_scheduler_status()}
