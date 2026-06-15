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

import sys
from pathlib import Path

# Ensure backend + package roots are importable before web_fetch / Playwright setup.
_PKG_DIR = Path(__file__).resolve().parent
_BACKEND_DIR = _PKG_DIR.parent
if str(_PKG_DIR) not in sys.path:
    sys.path.insert(0, str(_PKG_DIR))
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

import web_fetch.asyncio_policy  # noqa: F401  # before asyncio / Playwright on Windows

import contextlib
import io
import logging
import os
import threading
import time
import uuid

# Suppress HuggingFace / transformers progress bars that use emoji on Windows consoles.
os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl

from listing_discoverer import (  # noqa: E402
    LISTING_CONFIDENCE_THRESHOLD,
    ListingDiscoverer,
    classify_for_discovery,
    extract_page_features,
    normalize_url,
    same_domain,
)
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

DiscoveryOutcome = Literal["success", "partial", "failed"]


def _compute_discovery_outcome(raw: dict, listing_count: int) -> dict:
    """
    Derive discovery outcome, human-readable reasons, and whether the admin
    should enter endpoints manually.
    """
    cache = raw.get("cache", [])
    root_url = raw.get("root_url", "")
    total = len(cache)
    fetch_errors = sum(1 for e in cache if e.get("fetch_error"))
    sitemap_seeds = raw.get("sitemap_seed_urls") or []

    root_entry = next(
        (e for e in cache if normalize_url(e.get("url", "")) == normalize_url(root_url)),
        None,
    )
    root_fetch_failed = bool(
        root_entry
        and (root_entry.get("fetch_error") or not root_entry.get("processed"))
    )
    sitemap_used = len(sitemap_seeds) > 0
    sitemap_infer_count = sum(
        1 for e in cache
        if (e.get("rejection_reason") or "").startswith("sitemap-infer")
    )
    high_fetch_error_rate = total > 0 and (fetch_errors / total) >= 0.4

    reasons: list[str] = []

    if listing_count == 0:
        outcome: DiscoveryOutcome = "failed"
        if root_fetch_failed:
            reasons.append(
                "The root homepage could not be fetched (possible CDN or bot blocking)."
            )
        if root_fetch_failed and not sitemap_used:
            reasons.append("No sitemap.xml was available to seed discovery.")
        if fetch_errors > 0:
            reasons.append(f"{fetch_errors} page(s) failed to fetch during discovery.")
        if total > 0 and not root_fetch_failed:
            reasons.append(
                "Pages were fetched but none were classified as article listing pages."
            )
        if not reasons:
            reasons.append("No listing endpoints could be identified on this domain.")
    elif root_fetch_failed or sitemap_used or high_fetch_error_rate or sitemap_infer_count > 0:
        outcome = "partial"
        if root_fetch_failed:
            reasons.append(
                "The root homepage could not be fetched; discovery relied on alternative methods."
            )
        if sitemap_used:
            reasons.append(
                f"Discovery used sitemap.xml to seed {len(sitemap_seeds)} URL(s)."
            )
        if sitemap_infer_count > 0:
            reasons.append(
                f"{sitemap_infer_count} URL(s) were inferred from sitemap structure "
                "without fetching the page."
            )
        if fetch_errors > 0:
            reasons.append(f"{fetch_errors} of {total} page(s) failed to fetch.")
        reasons.append(
            f"Only {listing_count} listing endpoint(s) were found. "
            "Please verify results and add any missing endpoints manually."
        )
    else:
        outcome = "success"

    requires_manual_entry = outcome in ("partial", "failed")
    if outcome == "failed":
        manual_message = (
            "Automatic discovery could not find listing endpoints for this domain. "
            "Enter each endpoint URL below — each one will be tested to confirm it "
            "can be crawled for articles. Only endpoints that pass assessment will be saved."
        )
    elif outcome == "partial":
        manual_message = (
            "Discovery found some endpoints but could not fully map this domain. "
            "Review the results below and add any missing endpoints one by one. "
            "Each manually entered URL will be assessed before it can be saved."
        )
    else:
        manual_message = ""

    return {
        "discovery_outcome": outcome,
        "reasons": reasons,
        "requires_manual_entry": requires_manual_entry,
        "manual_entry_message": manual_message,
    }


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
                "depth": entry.get("tree_depth"),
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

    outcome_info = _compute_discovery_outcome(raw, len(endpoints))

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
            "sitemap_seeds": len(raw.get("sitemap_seed_urls") or []),
        },
        "tree": raw.get("tree"),
        **outcome_info,
    }


_BROWSER_VERIFY_LOCK = threading.Lock()
_BROWSER_LAUNCH_VERIFIED: Optional[bool] = None
_BROWSER_LAUNCH_ERROR: Optional[str] = None


def _format_playwright_error(exc: BaseException) -> str:
    if isinstance(exc, NotImplementedError):
        return (
            "NotImplementedError: Windows asyncio cannot spawn Playwright subprocesses "
            "(restart the discovery service after updating web_fetch.asyncio_policy)"
        )
    msg = str(exc).strip()
    if msg:
        return f"{type(exc).__name__}: {msg}"
    return f"{type(exc).__name__}: {repr(exc)}"


def _reset_browser_verify_cache() -> None:
    global _BROWSER_LAUNCH_VERIFIED, _BROWSER_LAUNCH_ERROR
    _BROWSER_LAUNCH_VERIFIED = None
    _BROWSER_LAUNCH_ERROR = None


def _chromium_on_disk() -> bool:
    import subprocess

    try:
        result = subprocess.run(
            [sys.executable, "-m", "playwright", "install", "--dry-run", "chromium"],
            capture_output=True,
            text=True,
            timeout=60,
        )
    except Exception:
        return False

    for line in (result.stdout or "").splitlines():
        if "Install location:" not in line:
            continue
        base = Path(line.split(":", 1)[1].strip())
        candidates = [
            base / "chrome-win64" / "chrome.exe",
            base / "chrome-headless-shell-win64" / "chrome-headless-shell.exe",
            base / "chrome-linux" / "chrome",
            base / "chrome-headless-shell-linux64" / "chrome-headless-shell",
            base / "chrome-mac" / "Chromium.app",
        ]
        if any(path.exists() for path in candidates):
            return True
    return False


def _try_launch_chromium(*, retries: int = 3) -> Optional[str]:
    """Return None if Chromium launches; otherwise a short error message."""
    global _BROWSER_LAUNCH_VERIFIED, _BROWSER_LAUNCH_ERROR

    from web_fetch.browser import verify_browser_ready

    with _BROWSER_VERIFY_LOCK:
        if _BROWSER_LAUNCH_VERIFIED is True:
            return None
        if _BROWSER_LAUNCH_VERIFIED is False and _BROWSER_LAUNCH_ERROR:
            return _BROWSER_LAUNCH_ERROR

        last_err = "unknown launch error"
        for attempt in range(retries):
            try:
                import playwright  # noqa: F401
            except ImportError as exc:
                err = _format_playwright_error(exc)
                _BROWSER_LAUNCH_VERIFIED = False
                _BROWSER_LAUNCH_ERROR = err
                return err

            launch_error = verify_browser_ready()
            if launch_error is None:
                _BROWSER_LAUNCH_VERIFIED = True
                _BROWSER_LAUNCH_ERROR = None
                return None
            last_err = launch_error
            if attempt < retries - 1:
                time.sleep(1.0 * (attempt + 1))

        _BROWSER_LAUNCH_VERIFIED = False
        _BROWSER_LAUNCH_ERROR = last_err
        return last_err


def _fetch_stack_status(*, verify_launch: bool = True) -> dict:
    status = {
        "python": sys.executable,
        "curl_cffi": False,
        "playwright": False,
        "playwright_browsers": False,
        "browser_launch_error": None,
    }
    try:
        import curl_cffi  # noqa: F401

        status["curl_cffi"] = True
    except ImportError:
        pass
    try:
        import playwright  # noqa: F401

        status["playwright"] = True
        if verify_launch:
            launch_error = _try_launch_chromium()
            if launch_error is None:
                status["playwright_browsers"] = True
            else:
                status["browser_launch_error"] = launch_error
        elif _BROWSER_LAUNCH_VERIFIED is True:
            status["playwright_browsers"] = True
        elif _BROWSER_LAUNCH_VERIFIED is False:
            status["browser_launch_error"] = _BROWSER_LAUNCH_ERROR
            status["playwright_browsers"] = _chromium_on_disk()
        else:
            status["playwright_browsers"] = _chromium_on_disk()
    except ImportError:
        pass
    return status


def _pip_install(packages: list[str], log_fn) -> bool:
    import subprocess

    log_fn(f"Installing Python packages: {', '.join(packages)}")
    result = subprocess.run(
        [sys.executable, "-m", "pip", "install", *packages],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        tail = (result.stderr or result.stdout or "").strip().splitlines()
        if tail:
            log_fn(f"pip error: {tail[-1]}")
        return False
    return True


def _install_playwright_browsers(log_fn, *, force: bool = False) -> bool:
    import subprocess

    label = "Re-installing" if force else "Installing"
    log_fn(f"{label} Playwright Chromium browser (one-time download)...")
    cmd = [sys.executable, "-m", "playwright", "install", "chromium"]
    if force:
        cmd.append("--force")
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=600,
    )
    output = (result.stdout or "") + (result.stderr or "")
    if result.returncode != 0:
        tail = output.strip().splitlines()
        if tail:
            log_fn(f"playwright install error: {tail[-1]}")
        else:
            log_fn(f"playwright install failed (exit {result.returncode})")
        return False

    _reset_browser_verify_cache()
    launch_error = _try_launch_chromium()
    if launch_error is not None:
        log_fn(f"playwright install finished but Chromium launch failed: {launch_error}")
        return False
    return True


def _ensure_fetch_stack(log_fn) -> dict:
    """Install missing fetch dependencies for this Python interpreter."""
    log_fn(f"Fetch stack Python: {sys.executable}")

    stack = _fetch_stack_status()
    if not stack["curl_cffi"]:
        _pip_install(["curl_cffi", "brotli"], log_fn)
    if not stack["playwright"]:
        _reset_browser_verify_cache()
        _pip_install(["playwright"], log_fn)

    stack = _fetch_stack_status()
    if stack["playwright"] and not stack["playwright_browsers"]:
        if not _chromium_on_disk():
            _install_playwright_browsers(log_fn)
        else:
            _reset_browser_verify_cache()
            launch_error = _try_launch_chromium()
            if launch_error is not None:
                log_fn(f"Chromium on disk but launch failed: {launch_error}")
                _install_playwright_browsers(log_fn, force=True)

    return _fetch_stack_status()


def _log_fetch_readiness(log_fn) -> None:
    stack = _ensure_fetch_stack(log_fn)
    if not stack["curl_cffi"]:
        log_fn(f"WARN: curl_cffi missing for {stack['python']}")
    if not stack["playwright"]:
        log_fn(f"WARN: playwright missing for {stack['python']}")
    elif not stack["playwright_browsers"]:
        detail = stack.get("browser_launch_error") or "unknown launch error"
        log_fn(
            "WARN: Playwright browsers still missing after auto-install — "
            f"run manually: \"{stack['python']}\" -m playwright install chromium"
        )
        log_fn(f"WARN: Chromium launch error: {detail}")
    else:
        log_fn("Fetch stack ready (curl_cffi + Playwright).")


def _run_discovery(job: DiscoveryJob) -> None:
    job.status = "running"
    job.append_log(f"Starting discovery for {job.root_url} (max_depth={job.max_depth})")
    _log_fetch_readiness(job.append_log)

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
        outcome = result.get("discovery_outcome", "success")
        job.append_log(
            f"Discovery complete — outcome={outcome}, "
            f"{result['stats']['listing_pages_found']} listing endpoint(s) found."
        )
        for reason in result.get("reasons") or []:
            job.append_log(f"  Reason: {reason}")
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


class AssessEndpointRequest(BaseModel):
    url: HttpUrl
    root_url: Optional[HttpUrl] = None


def _assess_listing_endpoint(url: str, root_url: Optional[str] = None) -> dict:
    """
    Fetch a URL, classify it, and decide whether it is a crawlable listing endpoint.
    """
    norm_url = normalize_url(str(url))
    if not norm_url:
        return {
            "url": str(url),
            "crawlable": False,
            "classification": None,
            "confidence": None,
            "link_count": 0,
            "reasons": ["Invalid URL."],
            "fetch_error": "invalid url",
        }

    if root_url and not same_domain(norm_url, str(root_url)):
        return {
            "url": norm_url,
            "crawlable": False,
            "classification": None,
            "confidence": None,
            "link_count": 0,
            "reasons": [f"URL is not on the same domain as {root_url}."],
            "fetch_error": "domain mismatch",
        }

    from web_fetch import fetch_soup

    soup, result = fetch_soup(
        norm_url,
        profile="discovery",
        timeout=60,
        allow_browser=True,
    )
    if soup is None:
        detail = result.error or f"HTTP {result.status_code} via {result.method}"
        return {
            "url": norm_url,
            "crawlable": False,
            "classification": None,
            "confidence": None,
            "link_count": 0,
            "reasons": [f"Could not fetch the page ({detail})."],
            "fetch_error": detail,
        }

    predictor = _get_predictor()
    feats = extract_page_features(soup, norm_url)
    primary = predictor.predict_raw(
        title=feats["title"],
        text=feats["text"],
        url=norm_url,
        meta_tags=feats["meta_tags"],
        headings=feats["headings"],
        dom_stats=feats["dom_stats"],
        url_features=feats["url_features"],
        structural_features=feats["structural_features"],
        num_links=feats["num_links"],
        text_length=feats["text_length"],
        image_count=feats["image_count"],
    )
    clf = classify_for_discovery(primary)

    link_count = 0
    seen: set[str] = set()
    for tag in soup.find_all("a", href=True):
        child = normalize_url(tag["href"].strip(), base=norm_url)
        if not child or child in seen:
            continue
        if root_url and not same_domain(child, str(root_url)):
            continue
        seen.add(child)
        link_count += 1
        if link_count >= 500:
            break

    label = clf["label"]
    confidence = clf["confidence"]
    reasons: list[str] = []
    crawlable = False

    if label != "listing_article":
        listing_conf = clf.get("listing_confidence", confidence)
        pct = int(LISTING_CONFIDENCE_THRESHOLD * 100)
        reasons.append(
            f"Listing confidence {listing_conf:.1%} is below the {pct}% threshold."
        )
    elif link_count == 0:
        reasons.append(
            "Page is a listing page but contains no crawlable article links."
        )
    else:
        crawlable = True
        reasons.append(
            f"Listing page with {link_count} same-domain link(s) — suitable for crawling."
        )

    return {
        "url": norm_url,
        "crawlable": crawlable,
        "classification": label,
        "confidence": confidence,
        "link_count": link_count,
        "reasons": reasons,
        "fetch_error": None,
        "probabilities": clf.get("probabilities"),
        "listing_confidence": clf.get("listing_confidence"),
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health", tags=["ops"])
async def health() -> dict:
    from page_classifier.config import DEVICE

    return {
        "status": "ok",
        "fetch": _fetch_stack_status(verify_launch=False),
        "classifier_device": str(DEVICE),
    }


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


@app.post("/assess/endpoint", tags=["discovery"])
async def assess_endpoint(body: AssessEndpointRequest) -> dict:
    """
    Assess whether a single URL is a crawlable article-listing endpoint.
    Used when automatic discovery fails or is incomplete.
    """
    root = str(body.root_url) if body.root_url else None
    return _assess_listing_endpoint(str(body.url), root_url=root)


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

    uvicorn.run("endpoint_discovery.service:app", host="0.0.0.0", port=8004)
