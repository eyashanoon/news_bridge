"""Worker-based channel scheduler aligned with Site Crawler architecture."""

from __future__ import annotations

import math
import threading
import time
from datetime import datetime, timezone
from threading import Condition, Lock
from typing import Any, Callable

from backend_client import BackendClient
from crawler_service import ChannelCrawlService


class ChannelScheduler:
    """
    Continuously assigns Telegram channels to worker threads.

    Priority = crawlPriority from backend + staleness bonus.
    Low-score channels enter waitlist rotation (not ignored).
    No channel crawled twice consecutively when alternatives exist.
    """

    WAITLIST_THRESHOLD = 2.0
    WAITLIST_ROTATION_EVERY = 5  # pick one waitlist channel every N priority picks

    def __init__(
        self,
        service: ChannelCrawlService,
        backend: BackendClient,
        num_workers: int,
        score_alpha: float,
        staleness_weight: float,
        min_cooldown_seconds: float,
        log_fn: Callable[[str, str], None],
    ) -> None:
        self._service = service
        self._backend = backend
        self._num_workers = num_workers
        self._alpha = score_alpha
        self._staleness_weight = staleness_weight
        self._min_cooldown = max(30.0, float(min_cooldown_seconds))
        self._log = log_fn

        self._pending: dict[int, dict] = {}
        self._active: set[int] = set()
        self._cv: Condition = Condition(Lock())

        self._scores: dict[int, float] = {}
        self._scores_lock = Lock()
        self._last_crawled_time: dict[int, float] = {}
        self._crawl_counts: dict[int, int] = {}
        self._waitlist_ids: set[int] = set()
        self._waitlist_index = 0
        self._priority_pick_count = 0

        self._last_global_channel: int | None = None

        self._paused = False
        self._stopped = False
        self._workers: list[threading.Thread] = []

        self._channel_status: list[dict] = [
            {"status": "idle", "channel": None, "channelId": None, "startedAt": None}
            for _ in range(num_workers)
        ]
        self._channel_lock = Lock()

        self._total_crawls = 0
        self._total_posts = 0
        self._stats_lock = Lock()

        self._mtproto_lock = Lock()

    def _effective_priority(self, cid: int) -> float:
        ch = self._pending.get(cid, {})
        backend_priority = ch.get("crawlPriority", 0.0)
        with self._scores_lock:
            local_score = self._scores.get(cid, ch.get("crawlScore", 0.0))

        last_t = self._last_crawled_time.get(cid)
        if last_t is None:
            return 9999.0 + backend_priority + local_score
        hours_since = max(0.0, time.time() - last_t) / 3600.0
        staleness = math.sqrt(hours_since) * self._staleness_weight
        return backend_priority + local_score + staleness

    def _seconds_until_ready(self, cid: int) -> float:
        last_t = self._last_crawled_time.get(cid)
        if last_t is None:
            return 0.0
        elapsed = time.time() - last_t
        return max(0.0, self._min_cooldown - elapsed)

    def _is_ready(self, cid: int) -> bool:
        return self._seconds_until_ready(cid) <= 0.0

    def _pick_from_waitlist(self) -> tuple[int, dict] | tuple[None, None]:
        waitlist = sorted(
            [cid for cid in self._waitlist_ids if cid in self._pending and cid not in self._active],
            key=lambda c: self._last_crawled_time.get(c, 0),
        )
        if not waitlist:
            return None, None
        self._waitlist_index = self._waitlist_index % len(waitlist)
        cid = waitlist[self._waitlist_index]
        self._waitlist_index += 1
        return cid, self._pending[cid]

    def _pick_next(self) -> tuple[int, dict] | tuple[None, None]:
        available = [
            cid for cid in self._pending
            if cid not in self._active and self._is_ready(cid)
        ]
        if not available:
            return None, None

        # Waitlist rotation — prevent starvation
        self._priority_pick_count += 1
        if (
            self._waitlist_ids
            and self._priority_pick_count % self.WAITLIST_ROTATION_EVERY == 0
        ):
            cid, ch = self._pick_from_waitlist()
            if cid is not None and cid != self._last_global_channel:
                return cid, ch

        best_cid: int | None = None
        best_p = -1.0
        for cid in available:
            if cid == self._last_global_channel and len(available) > 1:
                continue
            p = self._effective_priority(cid)
            if p > best_p:
                best_p = p
                best_cid = cid

        if best_cid is None:
            best_cid = available[0]

        return best_cid, self._pending[best_cid]

    def load_channels(self) -> None:
        try:
            channels = self._backend.get_active_channels()
            loaded = 0
            active_ids: set[int] = set()
            with self._cv:
                for ch in channels:
                    cid = int(ch["id"])
                    active_ids.add(cid)
                    if ch.get("crawlScore") is not None:
                        with self._scores_lock:
                            if cid not in self._scores:
                                self._scores[cid] = float(ch["crawlScore"])

                    last_crawled = ch.get("lastCrawledAt")
                    if last_crawled and cid not in self._last_crawled_time:
                        try:
                            lc = datetime.fromisoformat(
                                last_crawled.replace("Z", "+00:00")
                            )
                            elapsed = (
                                datetime.now(timezone.utc) - lc.astimezone(timezone.utc)
                            ).total_seconds()
                            self._last_crawled_time[cid] = time.time() - elapsed
                        except Exception:
                            pass

                    self._pending[cid] = ch
                    if ch.get("waitlist"):
                        self._waitlist_ids.add(cid)
                    loaded += 1

                for cid in list(self._pending.keys()):
                    if cid not in active_ids:
                        del self._pending[cid]
                        self._active.discard(cid)
                        self._waitlist_ids.discard(cid)

                self._cv.notify_all()
            self._log("INFO", f"Scheduler loaded {loaded} active channel(s)")
        except Exception as ex:
            self._log("ERROR", f"Failed to load channels: {ex}")

    def _update_channel(self, worker_id: int, status: str, username: str | None, channel_id: int | None) -> None:
        with self._channel_lock:
            self._channel_status[worker_id] = {
                "status": status,
                "channel": username,
                "channelId": channel_id,
                "startedAt": datetime.utcnow().isoformat() if status == "crawling" else None,
            }

    def _worker(self, worker_id: int) -> None:
        self._log("INFO", f"[W{worker_id}] Worker started")
        while not self._stopped:
            with self._cv:
                while self._paused and not self._stopped:
                    self._cv.wait(timeout=1.0)
                if self._stopped:
                    break

                cid, ch = self._pick_next()
                if cid is None:
                    wait_s = 2.0
                    for pending_id in self._pending:
                        if pending_id not in self._active:
                            wait_s = min(wait_s, max(1.0, self._seconds_until_ready(pending_id)))
                    self._cv.wait(timeout=wait_s)
                    continue
                self._active.add(cid)

            username = ch.get("channelUsername", "")
            self._update_channel(worker_id, "crawling", username, cid)
            self._log("INFO", f"[W{worker_id}] Crawling @{username} (id={cid})")

            posts_created = 0
            try:
                with self._mtproto_lock:
                    stats = self._service.crawl_channel(ch)
                posts_created = stats.get("posts_created", 0)

                with self._stats_lock:
                    self._total_crawls += 1
                    self._total_posts += posts_created

                self._log(
                    "INFO",
                    f"[W{worker_id}] @{username}: {posts_created} new post(s)",
                )
            except Exception as ex:
                self._log("ERROR", f"[W{worker_id}] Crawl failed @{username}: {ex}")

            with self._scores_lock:
                old = self._scores.get(cid, 0.0)
                self._scores[cid] = self._alpha * posts_created + (1.0 - self._alpha) * old

            self._last_crawled_time[cid] = time.time()
            self._crawl_counts[cid] = self._crawl_counts.get(cid, 0) + 1
            self._last_global_channel = cid

            priority = self._effective_priority(cid)
            if priority < self.WAITLIST_THRESHOLD and self._crawl_counts[cid] > 3:
                self._waitlist_ids.add(cid)
            else:
                self._waitlist_ids.discard(cid)

            self._update_channel(worker_id, "idle", None, None)

            with self._cv:
                self._active.discard(cid)
                if not self._stopped:
                    self._cv.notify_all()

        self._update_channel(worker_id, "stopped", None, None)
        self._log("INFO", f"[W{worker_id}] Worker stopped")

    def start(self) -> None:
        for i in range(self._num_workers):
            t = threading.Thread(
                target=self._worker,
                args=(i,),
                daemon=True,
                name=f"telegram-worker-{i}",
            )
            t.start()
            self._workers.append(t)
        self._log("INFO", f"Channel scheduler started — {self._num_workers} worker(s)")

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
        self._last_crawled_time.clear()
        self._last_global_channel = None
        with self._cv:
            count = len(self._pending)
            self._cv.notify_all()
        return count

    def reload_channels(self) -> None:
        """Merge active channels from backend without resetting worker state."""
        self.load_channels()

    def get_status(self) -> dict:
        with self._channel_lock:
            workers = [{"id": i, **s} for i, s in enumerate(self._channel_status)]

        now = time.time()
        with self._cv:
            pending_ids = [cid for cid in self._pending if cid not in self._active]
            active_count = len(self._active)

        priority_sorted = sorted(pending_ids, key=self._effective_priority, reverse=True)[:15]
        waitlist_sorted = sorted(
            [cid for cid in self._waitlist_ids if cid in pending_ids],
            key=lambda c: self._last_crawled_time.get(c, 0),
        )[:10]

        queued = []
        for cid in priority_sorted:
            ch = self._pending.get(cid, {})
            last_t = self._last_crawled_time.get(cid)
            queued.append({
                "id": cid,
                "username": ch.get("channelUsername", ""),
                "priority": round(self._effective_priority(cid), 2),
                "waitlist": cid in self._waitlist_ids,
                "minutesSinceCrawl": None if last_t is None else round((now - last_t) / 60, 1),
                "crawlCount": self._crawl_counts.get(cid, 0),
            })

        with self._stats_lock:
            total_crawls = self._total_crawls
            total_posts = self._total_posts

        return {
            "workers": workers,
            "channels": workers,
            "queueSize": len(pending_ids),
            "activeChannels": active_count,
            "waitlistSize": len([c for c in waitlist_sorted]),
            "paused": self._paused,
            "stopped": self._stopped,
            "totalCrawls": total_crawls,
            "totalPostsCreated": total_posts,
            "minCooldownSeconds": self._min_cooldown,
            "queuedChannels": queued,
            "waitlistChannels": [
                {"id": cid, "username": self._pending.get(cid, {}).get("channelUsername", "")}
                for cid in waitlist_sorted
            ],
        }

    def restart(self) -> None:
        self._stopped = True
        with self._cv:
            self._cv.notify_all()
        with self._cv:
            self._stopped = False
            self._paused = False
            self._pending.clear()
            self._active.clear()
        self._last_crawled_time.clear()
        self._crawl_counts.clear()
        self._waitlist_ids.clear()
        self._last_global_channel = None
        with self._scores_lock:
            self._scores.clear()
        with self._channel_lock:
            self._channel_status = [
                {"status": "idle", "channel": None, "channelId": None, "startedAt": None}
                for _ in range(self._num_workers)
            ]
        with self._stats_lock:
            self._total_crawls = 0
            self._total_posts = 0
        self._workers = []
        self.load_channels()
        self.start()
