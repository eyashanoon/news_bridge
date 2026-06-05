"""
service.py — FastAPI application for listing-endpoint discovery.

Uses the page_classifier model and ListingDiscoverer BFS crawler from the
listingdiscovery project.

Endpoints:
    POST /discover/start   — start an async discovery job, returns job_id
    GET  /discover/jobs/{job_id} — poll job status, logs, and result
    POST /discover         — synchronous discovery (legacy, blocks until done)
    GET  /health           — liveness probe

Run locally::

    uvicorn endpoint_discovery.service:app --reload --port 8004
"""

from __future__ import annotations

import contextlib
import io
import logging
import os
import sys
import threading
import time
import uuid

# Suppress HuggingFace / transformers progress bars that use emoji on Windows consoles.
os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl

# Ensure page_classifier and listing_discoverer are importable from this package dir.
_PKG_DIR = Path(__file__).resolve().parent
if str(_PKG_DIR) not in sys.path:
    sys.path.insert(0, str(_PKG_DIR))

from listing_discoverer import ListingDiscoverer  # noqa: E402
from page_classifier import Predictor  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Endpoint Discovery Service",
    description=(
        "Discovers article-listing endpoints within a domain using BFS and "
        "the page_classifier ML model (listing_article / content_article / other)."
    ),
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ── Shared model (loaded once) ────────────────────────────────────────────────

_predictor: Optional[Predictor] = None
_predictor_lock = threading.Lock()


@contextlib.contextmanager
def _silence_stdout():
    """Capture library print() calls (e.g. HuggingFace emoji progress) during model load."""
    buf = io.StringIO()
    old_stdout = sys.stdout
    try:
        sys.stdout = buf
        yield buf
    finally:
        sys.stdout = old_stdout
        captured = buf.getvalue().strip()
        if captured:
            # Log captured output as ASCII-safe lines for the job console.
            for line in captured.splitlines():
                safe = line.encode("ascii", errors="replace").decode("ascii")
                if safe.strip():
                    logger.info("model-load: %s", safe)


def _get_predictor() -> Predictor:
    global _predictor
    with _predictor_lock:
        if _predictor is None:
            logger.info("Loading page classifier model ...")
            with _silence_stdout():
                _predictor = Predictor()
        return _predictor


# ── Job store ─────────────────────────────────────────────────────────────────

JobStatus = Literal["pending", "running", "completed", "failed"]


@dataclass
class DiscoveryJob:
    job_id: str
    root_url: str
    max_depth: int
    status: JobStatus = "pending"
    logs: list[str] = field(default_factory=list)
    result: Optional[dict] = None
    error: Optional[str] = None
    started_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    finished_at: Optional[str] = None
    _log_lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def append_log(self, msg: str) -> None:
        with self._log_lock:
            self.logs.append(msg)

    def to_dict(self, log_offset: int = 0) -> dict:
        with self._log_lock:
            logs = self.logs[log_offset:]
        payload: dict[str, Any] = {
            "job_id": self.job_id,
            "root_url": self.root_url,
            "max_depth": self.max_depth,
            "status": self.status,
            "logs": logs,
            "log_count": len(self.logs),
            "started_at": self.started_at,
            "finished_at": self.finished_at,
        }
        if self.status == "completed" and self.result is not None:
            payload["result"] = self.result
        if self.status == "failed" and self.error:
            payload["error"] = self.error
        return payload


_jobs: dict[str, DiscoveryJob] = {}
_jobs_lock = threading.Lock()


def _store_job(job: DiscoveryJob) -> None:
    with _jobs_lock:
        _jobs[job.job_id] = job


def _get_job(job_id: str) -> DiscoveryJob:
    with _jobs_lock:
        job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")
    return job


# ── Result transformation ─────────────────────────────────────────────────────

def _transform_result(raw: dict) -> dict:
    """
    Convert ListingDiscoverer output into the API response shape expected by
    the Spring Boot proxy and admin UI.
    """
    root_url = raw["root_url"]
    cache = raw.get("cache", [])

    endpoints: list[dict] = []
    for entry in cache:
        if (
            entry.get("classification") == "listing_article"
            and entry.get("added_to_tree")
            and entry.get("url") != root_url
        ):
            endpoints.append({
                "url": entry["url"],
                "parent": entry.get("first_discovered_from"),
                "confidence": entry.get("confidence"),
                "classification": entry.get("classification"),
            })

    endpoints.sort(key=lambda e: (e.get("parent") or "", e["url"]))

    total = len(cache)
    in_tree = sum(1 for e in cache if e.get("added_to_tree"))
    fetch_errors = sum(1 for e in cache if e.get("fetch_error"))
    individually_tested = sum(
        1 for e in cache
        if e.get("processed") and e.get("classification")
        and not (e.get("rejection_reason") or "").startswith(
            ("pattern-cache:", "group-skip:", "skipped:")
        )
    )

    return {
        "root": root_url,
        "max_depth": raw.get("max_depth"),
        "endpoints": endpoints,
        "stats": {
            "urls_found": total,
            "listing_pages_found": len(endpoints),
            "tree_nodes": in_tree,
            "individually_tested": individually_tested,
            "fetch_errors": fetch_errors,
            "patterns_learned": len(raw.get("pattern_cache", {})),
        },
        "tree": raw.get("tree"),
    }


def _run_discovery(job: DiscoveryJob) -> None:
    job.status = "running"
    job.append_log(f"Starting discovery for {job.root_url} (max_depth={job.max_depth})")

    try:
        predictor = _get_predictor()
        job.append_log("Page classifier model ready.")

        discoverer = ListingDiscoverer(
            root_url=job.root_url,
            predictor=predictor,
            max_depth=job.max_depth,
            log_callback=job.append_log,
        )
        raw = discoverer.discover()
        result = _transform_result(raw)

        job.result = result
        job.status = "completed"
        job.finished_at = datetime.now(timezone.utc).isoformat()
        job.append_log(
            f"Discovery complete — {result['stats']['listing_pages_found']} "
            f"listing endpoint(s) found."
        )
        logger.info(
            "Job %s complete — %d listing endpoints",
            job.job_id,
            result["stats"]["listing_pages_found"],
        )
    except Exception as exc:
        job.status = "failed"
        job.error = str(exc)
        job.finished_at = datetime.now(timezone.utc).isoformat()
        job.append_log(f"ERROR: {exc}")
        logger.exception("Discovery job %s failed", job.job_id)


# ── Request models ────────────────────────────────────────────────────────────

class DiscoveryRequest(BaseModel):
    root_url: HttpUrl
    max_depth: int = 2


class StartDiscoveryRequest(DiscoveryRequest):
    pass


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["ops"])
async def health() -> dict:
    return {"status": "ok"}


@app.post("/discover/start", tags=["discovery"])
async def start_discovery(body: StartDiscoveryRequest) -> dict:
    """
    Start an async discovery job. Poll GET /discover/jobs/{job_id} for logs
    and the final result.
    """
    job_id = str(uuid.uuid4())
    job = DiscoveryJob(
        job_id=job_id,
        root_url=str(body.root_url),
        max_depth=body.max_depth,
    )
    _store_job(job)

    thread = threading.Thread(target=_run_discovery, args=(job,), daemon=True)
    thread.start()

    logger.info("Started discovery job %s for %s", job_id, body.root_url)
    return {"job_id": job_id, "root_url": str(body.root_url), "status": "pending"}


@app.get("/discover/jobs/{job_id}", tags=["discovery"])
async def get_job(
    job_id: str,
    log_offset: int = 0,
) -> dict:
    """
    Poll a discovery job. Pass log_offset to receive only new log lines
    since the last poll (use the log_count from the previous response).
    """
    job = _get_job(job_id)
    return job.to_dict(log_offset=max(0, log_offset))


@app.post("/discover", tags=["discovery"])
async def discover_sync(body: DiscoveryRequest) -> dict:
    """
    Run discovery synchronously (blocks until complete).
    Prefer POST /discover/start for long-running crawls with live log streaming.
    """
    job_id = str(uuid.uuid4())
    job = DiscoveryJob(
        job_id=job_id,
        root_url=str(body.root_url),
        max_depth=body.max_depth,
    )
    _store_job(job)
    _run_discovery(job)

    if job.status == "failed":
        raise HTTPException(status_code=500, detail=job.error or "Discovery failed")

    return job.result  # type: ignore[return-value]


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("endpoint_discovery.service:app", host="0.0.0.0", port=8004, reload=True)
