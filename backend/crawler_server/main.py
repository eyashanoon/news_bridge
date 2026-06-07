from __future__ import annotations

import collections
import logging
import math
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
import sys
from threading import Lock, Condition
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
from page_classifier_adapter import is_article
from post_processor import process_pending_posts

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

# ─── App + backend ────────────────────────────────────────────────────────────
app = FastAPI(title="News Collector Server", version="2.0.0")

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


# ─── Endpoint Scheduler ───────────────────────────────────────────────────────
class EndpointScheduler:
    """
    Continuously assigns listing endpoints to worker channels (threads).

    All N channels are kept busy at all times.  When a channel finishes crawling
    it immediately picks the highest-priority endpoint that is not currently active.

    Priority formula (higher = crawled sooner):
        priority = production_score + staleness_bonus
        production_score = EMA of articles_found per crawl   (seeded from backend)
        staleness_bonus  = sqrt(hours_since_last_crawl) * staleness_weight
                           → endpoints not crawled recently rise in priority
        first crawl ever → priority = 9999 + production_score  (maximum urgency)

    No fixed delays: the score-based ordering is the sole scheduling mechanism.
    """

    def __init__(
        self,
        service: CrawlerService,
        backend: BackendClient,
        num_channels: int,
        score_alpha: float,
        staleness_weight: float,
        log_fn,
    ) -> None:
        self._service = service
        self._backend = backend
        self._num_channels = num_channels
        self._alpha = score_alpha
        self._staleness_weight = staleness_weight
        self._log = log_fn

        # Endpoint pool: id → endpoint dict (all known active endpoints)
        self._pending: dict[int, dict] = {}
        # Set of endpoint ids currently being crawled
        self._active: set[int] = set()

        # Condition variable – workers wait here when the pool is empty or paused
        self._cv: Condition = Condition(Lock())

        # Scores: EMA of articles found per crawl
        self._scores: dict[int, float] = {}
        self._scores_lock = Lock()

        # Timing: wall-clock time of last crawl completion per endpoint
        self._last_crawled_time: dict[int, float] = {}
        # How many times each endpoint has been crawled this session
        self._crawl_counts: dict[int, int] = {}

        self._paused = False
        self._stopped = False
        self._workers: list[threading.Thread] = []

        # Per-channel display status
        self._channel_status: list[dict] = [
            {"status": "idle", "endpoint": None, "endpointId": None, "startedAt": None}
            for _ in range(num_channels)
        ]
        self._channel_lock = Lock()

        # Session totals
        self._total_crawls = 0
        self._total_articles = 0
        self._stats_lock = Lock()

    # ── Scoring ───────────────────────────────────────────────────────────────

    def _effective_priority(self, eid: int) -> float:
        """
        Combine productivity score with staleness bonus.
        Called while _cv may be held; acquires _scores_lock only briefly.
        """
        with self._scores_lock:
            prod = self._scores.get(eid, 0.0)
        last_t = self._last_crawled_time.get(eid)
        if last_t is None:
            # Never crawled this session – maximum urgency
            return 9999.0 + prod
        hours_since = max(0.0, time.time() - last_t) / 3600.0
        staleness = math.sqrt(hours_since) * self._staleness_weight
        return prod + staleness

    def _pick_next(self) -> tuple[int, dict] | tuple[None, None]:
        """
        Return the (eid, endpoint) with the highest priority that is not active.
        Must be called while holding self._cv.
        """
        best_eid: int | None = None
        best_p = -1.0
        for eid, ep in self._pending.items():
            if eid in self._active:
                continue
            p = self._effective_priority(eid)
            if p > best_p:
                best_p = p
                best_eid = eid
        if best_eid is None:
            return None, None
        return best_eid, self._pending[best_eid]

    # ── Channel display ───────────────────────────────────────────────────────

    def _update_channel(
        self, channel_id: int, status: str, endpoint_url: str | None,
        endpoint_id: int | None = None,
    ) -> None:
        with self._channel_lock:
            self._channel_status[channel_id] = {
                "status": status,
                "endpoint": endpoint_url,
                "endpointId": endpoint_id,
                "startedAt": datetime.utcnow().isoformat() if status == "crawling" else None,
            }

    # ── Endpoint loading ──────────────────────────────────────────────────────

    def load_endpoints(self) -> None:
        """Fetch all active endpoints from the backend and populate the pending pool."""
        try:
            roots = self._backend.get_roots()
            loaded = 0
            with self._cv:
                for root in roots:
                    root_id = int(root["id"])
                    endpoints = self._backend.get_endpoints(root_id)
                    for ep in endpoints:
                        if ep.get("status", "").upper() != "ACTIVE":
                            continue
                        eid = int(ep["id"])

                        # Seed production score from backend persisted value
                        persisted_score = ep.get("crawlScore")
                        if persisted_score is not None:
                            with self._scores_lock:
                                if eid not in self._scores:
                                    self._scores[eid] = float(persisted_score)

                        # Seed last_crawled_time from backend lastCrawledAt
                        last_crawled = ep.get("lastCrawledAt")
                        if last_crawled and eid not in self._last_crawled_time:
                            try:
                                lc = datetime.fromisoformat(
                                    last_crawled.replace("Z", "+00:00")
                                )
                                elapsed = (
                                    datetime.now(timezone.utc) - lc
                                ).total_seconds()
                                self._last_crawled_time[eid] = time.time() - elapsed
                            except Exception:
                                pass

                        self._pending[eid] = ep
                        loaded += 1

                self._cv.notify_all()
            self._log("INFO", f"Scheduler loaded {loaded} active endpoint(s) into pool")
        except Exception as ex:
            self._log("ERROR", f"Failed to load endpoints: {ex}")

    # ── Worker ────────────────────────────────────────────────────────────────

    def _worker(self, channel_id: int) -> None:
        self._log("INFO", f"[CH{channel_id}] Worker started")
        while not self._stopped:
            with self._cv:
                # Wait while paused
                while self._paused and not self._stopped:
                    self._cv.wait(timeout=1.0)
                if self._stopped:
                    break

                # Pick the best available endpoint
                eid, ep = self._pick_next()
                if eid is None:
                    # No unclaimed endpoint available – wait briefly
                    self._cv.wait(timeout=2.0)
                    continue

                # Claim the endpoint before releasing the lock
                self._active.add(eid)

            # ── Crawl (outside the lock) ──────────────────────────────────────
            listing_url = str(ep.get("url", ""))
            root_id = int(ep.get("rootId") or ep.get("root_id") or 0)
            self._update_channel(channel_id, "crawling", listing_url, endpoint_id=eid)
            self._log("INFO", f"[CH{channel_id}] Crawling EP #{eid}: {listing_url}")

            articles_created = 0
            try:
                articles_created = self._service.crawl_endpoint(
                    root_id=root_id,
                    endpoint_id=eid,
                    listing_url=listing_url,
                )
                try:
                    self._backend.update_crawl_stats(eid, articles_created)
                except Exception as sync_ex:
                    self._log("WARN", f"[CH{channel_id}] Stats sync failed: {sync_ex}")

                with self._stats_lock:
                    self._total_crawls += 1
                    self._total_articles += articles_created

                self._log(
                    "INFO",
                    f"[CH{channel_id}] EP #{eid}: {articles_created} new article(s)",
                )
            except Exception as ex:
                self._log(
                    "ERROR",
                    f"[CH{channel_id}] Crawl failed for #{eid} ({listing_url}): {ex}",
                )

            # ── Update EMA production score ───────────────────────────────────
            with self._scores_lock:
                old_score = self._scores.get(eid, 0.0)
                new_score = self._alpha * articles_created + (1.0 - self._alpha) * old_score
                self._scores[eid] = new_score

            # Record completion time and count
            self._last_crawled_time[eid] = time.time()
            self._crawl_counts[eid] = self._crawl_counts.get(eid, 0) + 1

            self._update_channel(channel_id, "idle", None)

            # ── Release endpoint (no delay – priority handles scheduling) ─────
            with self._cv:
                self._active.discard(eid)
                if not self._stopped:
                    self._cv.notify_all()

        self._update_channel(channel_id, "stopped", None)
        self._log("INFO", f"[CH{channel_id}] Worker stopped")

    # ── Control ───────────────────────────────────────────────────────────────

    def start(self) -> None:
        for i in range(self._num_channels):
            t = threading.Thread(
                target=self._worker,
                args=(i,),
                daemon=True,
                name=f"crawler-ch{i}",
            )
            t.start()
            self._workers.append(t)
        self._log(
            "INFO",
            f"Endpoint scheduler started — {self._num_channels} channel(s) | "
            f"alpha={self._alpha}  staleness_weight={self._staleness_weight}",
        )

    def pause(self) -> None:
        self._paused = True
        with self._cv:
            self._cv.notify_all()

    def resume(self) -> None:
        self._paused = False
        with self._cv:
            self._cv.notify_all()

    def stop(self) -> None:
        self._stopped = True
        with self._cv:
            self._cv.notify_all()

    def trigger_run_now(self) -> int:
        """
        Reset all staleness timers so every endpoint gains maximum urgency.
        The workers will immediately pick the highest-production-score endpoints.
        """
        self._last_crawled_time.clear()
        with self._cv:
            count = len(self._pending)
            self._cv.notify_all()
        return count

    # ── Status ────────────────────────────────────────────────────────────────

    def get_status(self) -> dict:
        with self._channel_lock:
            channels = [{"id": i, **ch} for i, ch in enumerate(self._channel_status)]

        now = time.time()
        with self._cv:
            pending_eids = [eid for eid in self._pending if eid not in self._active]
            active_count = len(self._active)

        # Sort pending by effective priority (highest first)
        pending_sorted = sorted(pending_eids, key=self._effective_priority, reverse=True)[:15]

        queued_endpoints: list[dict] = []
        for eid in pending_sorted:
            ep = self._pending.get(eid, {})
            with self._scores_lock:
                base_score = round(self._scores.get(eid, 0.0), 3)
            last_t = self._last_crawled_time.get(eid)
            minutes_since = None if last_t is None else round((now - last_t) / 60, 1)
            priority = round(self._effective_priority(eid), 2)
            queued_endpoints.append({
                "id": eid,
                "url": ep.get("url", ""),
                "priority": priority,
                "score": base_score,
                "minutesSinceCrawl": minutes_since,
                "crawlCount": self._crawl_counts.get(eid, 0),
            })

        with self._scores_lock:
            top_scores = sorted(
                self._scores.items(), key=lambda x: x[1], reverse=True
            )[:5]
        with self._stats_lock:
            total_crawls = self._total_crawls
            total_articles = self._total_articles

        return {
            "channels": channels,
            "queueSize": len(pending_eids),
            "activeEndpoints": active_count,
            "paused": self._paused,
            "stopped": self._stopped,
            "totalCrawls": total_crawls,
            "totalArticlesFound": total_articles,
            "topEndpointsByScore": [
                {"id": eid, "score": round(s, 3)} for eid, s in top_scores
            ],
            "queuedEndpoints": queued_endpoints,
        }

    # ── Restart ───────────────────────────────────────────────────────────────

    def restart(self) -> None:
        """Stop all workers, reset state, reload endpoints and start fresh."""
        self._stopped = True
        with self._cv:
            self._cv.notify_all()
        # Reset state
        with self._cv:
            self._stopped = False
            self._paused = False
            self._pending.clear()
            self._active.clear()
        self._last_crawled_time.clear()
        self._crawl_counts.clear()
        with self._scores_lock:
            self._scores.clear()
        with self._channel_lock:
            self._channel_status = [
                {"status": "idle", "endpoint": None, "endpointId": None, "startedAt": None}
                for _ in range(self._num_channels)
            ]
        with self._stats_lock:
            self._total_crawls = 0
            self._total_articles = 0
        self._workers = []
        self.load_endpoints()
        self.start()

    # ── Manual endpoint run ───────────────────────────────────────────────────

    def run_endpoint_now(self, endpoint_id: int) -> dict:
        """Run a specific endpoint immediately in a one-shot background thread."""
        ep: dict | None = self._pending.get(endpoint_id)
        if ep is None:
            try:
                roots = self._backend.get_roots()
                for root in roots:
                    root_id = int(root["id"])
                    endpoints = self._backend.get_endpoints(root_id)
                    for e in endpoints:
                        if int(e["id"]) == endpoint_id:
                            ep = e
                            break
                    if ep:
                        break
            except Exception as ex:
                return {"ok": False, "error": f"Backend lookup failed: {ex}"}
        if ep is None:
            return {"ok": False, "error": f"Endpoint #{endpoint_id} not found"}

        listing_url = str(ep.get("url", ""))
        root_id = int(ep.get("rootId") or ep.get("root_id") or 0)

        def _run() -> None:
            self._log("INFO", f"[MANUAL] Running EP #{endpoint_id}: {listing_url}")
            try:
                created = self._service.crawl_endpoint(root_id, endpoint_id, listing_url)
                try:
                    self._backend.update_crawl_stats(endpoint_id, created)
                except Exception:
                    pass
                self._log("INFO", f"[MANUAL] EP #{endpoint_id}: {created} new article(s)")
            except Exception as ex:
                self._log("ERROR", f"[MANUAL] EP #{endpoint_id} failed: {ex}")

        t = threading.Thread(target=_run, daemon=True, name=f"manual-ep{endpoint_id}")
        t.start()
        return {
            "ok": True, "endpointId": endpoint_id, "url": listing_url,
            "message": f"Crawl started in background for EP #{endpoint_id}",
        }


# ─── Scheduler instance ───────────────────────────────────────────────────────
_scheduler = EndpointScheduler(
    service=service,
    backend=backend,
    num_channels=settings.crawler_num_channels,
    score_alpha=settings.crawler_score_alpha,
    staleness_weight=settings.crawler_staleness_weight,
    log_fn=_push_log,
)

_post_scheduler = BackgroundScheduler(timezone="UTC")


def _run_post_processing_cycle() -> None:
    """Process pending posts for classification and tag extraction every 10 seconds."""
    try:
        _push_log("DEBUG", "Starting post-processing cycle...")
        result = process_pending_posts()
        classified = result.get("classified", 0)
        tagged = result.get("tagged", 0)
        if classified > 0 or tagged > 0:
            _push_log(
                "INFO",
                f"Post-processing completed: {classified} posts classified, {tagged} posts tagged",
            )
        else:
            _push_log("DEBUG", "No pending posts to process")
    except Exception as ex:
        _push_log("ERROR", f"Post-processing cycle failed: {ex}")


# ─── Lifecycle ────────────────────────────────────────────────────────────────
@app.on_event("startup")
def on_startup() -> None:
    _push_log("INFO", "Crawler server started — loading endpoints…")
    _scheduler.load_endpoints()
    _scheduler.start()

    _post_scheduler.add_job(
        _run_post_processing_cycle,
        "interval",
        seconds=10,
        id="post-processing-cycle",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    _post_scheduler.start()
    _push_log("INFO", "Post-processing scheduler started (interval: 10 seconds)")


@app.on_event("shutdown")
def on_shutdown() -> None:
    _scheduler.stop()
    if _post_scheduler.running:
        _post_scheduler.shutdown(wait=False)


# ─── Health / Status ──────────────────────────────────────────────────────────
@app.get("/health")
def health() -> dict:
    status = _scheduler.get_status()
    return {
        "ok": True,
        "schedulerRunning": not _scheduler._stopped,
        "paused": status["paused"],
        "numChannels": settings.crawler_num_channels,
        "backendBaseUrl": settings.backend_base_url,
        **status,
    }


@app.post("/run-now")
def run_now() -> dict:
    updated = _scheduler.trigger_run_now()
    _push_log("INFO", f"Run-now: {updated} endpoint(s) re-queued for immediate crawl")
    return {"ok": True, "message": f"{updated} endpoint(s) re-queued for immediate crawl"}


@app.get("/last-run")
def last_run() -> dict:
    status = _scheduler.get_status()
    return {
        "status": "continuous",
        "totalCrawls": status["totalCrawls"],
        "totalArticlesFound": status["totalArticlesFound"],
    }


@app.get("/control/status")
def scheduler_status() -> dict:
    status = _scheduler.get_status()
    return {
        "schedulerRunning": not _scheduler._stopped,
        "lastRun": {"status": "continuous"},
        **status,
    }


@app.post("/control/start")
def start_scheduler() -> dict:
    _scheduler.resume()
    _push_log("INFO", "Scheduler resumed by admin")
    return {"ok": True, "message": "Crawler scheduler resumed", **_scheduler.get_status()}


@app.post("/control/stop")
def stop_scheduler() -> dict:
    _scheduler.pause()
    _push_log("INFO", "Scheduler paused by admin")
    return {"ok": True, "message": "Crawler scheduler paused", **_scheduler.get_status()}


@app.post("/control/restart")
def restart_scheduler() -> dict:
    _push_log("INFO", "Scheduler restart requested by admin")
    _scheduler.restart()
    return {"ok": True, "message": "Crawler scheduler restarted"}


class RunEndpointRequest(BaseModel):
    endpointId: int


@app.post("/control/run-endpoint")
def run_endpoint_now(body: RunEndpointRequest) -> dict:
    _push_log("INFO", f"Manual crawl requested for endpoint #{body.endpointId}")
    result = _scheduler.run_endpoint_now(body.endpointId)
    if not result.get("ok"):
        raise HTTPException(status_code=404, detail=result.get("error", "Endpoint not found"))
    return result


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


# ─── Staleness weight control ─────────────────────────────────────────────────
class IntervalRequest(BaseModel):
    minutes: int   # repurposed: treated as staleness_weight * 10  (1–100 → 0.1–10.0)


@app.post("/control/interval")
def set_interval(body: IntervalRequest) -> dict:
    """Repurposed: sets the staleness weight (1–100 maps to 0.1–10.0)."""
    if body.minutes < 1 or body.minutes > 100:
        raise HTTPException(
            status_code=400, detail="Staleness weight must be between 1 and 100"
        )
    _scheduler._staleness_weight = body.minutes / 10.0
    _push_log("INFO", f"Staleness weight changed to {_scheduler._staleness_weight} by admin")
    return {
        "ok": True,
        "stalenessWeight": _scheduler._staleness_weight,
        **_scheduler.get_status(),
    }
