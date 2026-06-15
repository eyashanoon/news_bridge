"""Playwright browser pool with anti-detection settings."""

from __future__ import annotations

import web_fetch.asyncio_policy  # noqa: F401  # before Playwright on Windows

import asyncio
import logging
import os
import sys
import threading
import time
from typing import Optional
from urllib.parse import urlparse

from web_fetch.akamai import looks_like_access_denied, looks_like_akamai_challenge
from web_fetch.detection import looks_like_blocked_page

logger = logging.getLogger(__name__)

_BROWSER_LOCK = threading.Lock()
_CONTEXT_LOCK = threading.Lock()
_PLAYWRIGHT = None
_BROWSER = None
_CONTEXTS: dict[str, object] = {}
_MAX_CONTEXTS = int(os.environ.get("WEB_FETCH_MAX_BROWSER_CONTEXTS", "8"))
_LAST_PLAYWRIGHT_ERROR: Optional[str] = None

_CONSENT_SELECTORS = (
    "button:has-text('Accept')",
    "button:has-text('Agree')",
    "button:has-text('I agree')",
    "button:has-text('Allow all')",
    "button:has-text('Accept all')",
    "button:has-text('Continue without agreeing')",
    "button:has-text('Reject all')",
    "text=Accept",
    "text=Agree and close",
    "text=Continue without agreeing",
)

_STEALTH_INIT_SCRIPT = """
Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en']});
Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3, 4, 5]});
window.chrome = { runtime: {} };
"""

_AKAMAI_COOKIE_NAMES = {"_abck", "bm_sz", "ak_bmsc", "bm_sv"}


def _headless() -> bool:
    return os.environ.get("WEB_FETCH_HEADLESS", "true").lower() not in {"0", "false", "no"}


def _challenge_timeout() -> float:
    return float(os.environ.get("WEB_FETCH_CHALLENGE_TIMEOUT", "25"))


def _proxy() -> Optional[dict]:
    proxy_url = os.environ.get("WEB_FETCH_PROXY", "").strip()
    if not proxy_url:
        return None
    return {"server": proxy_url}


def get_last_playwright_error() -> Optional[str]:
    return _LAST_PLAYWRIGHT_ERROR


def _format_playwright_error(exc: BaseException) -> str:
    msg = str(exc).strip()
    if msg:
        return f"{type(exc).__name__}: {msg}"
    return f"{type(exc).__name__}: {repr(exc)}"


def _set_playwright_error(exc: Optional[BaseException]) -> None:
    global _LAST_PLAYWRIGHT_ERROR
    _LAST_PLAYWRIGHT_ERROR = _format_playwright_error(exc) if exc is not None else None


def _ensure_thread_event_loop() -> None:
    """Playwright subprocess transport needs ProactorEventLoop on Windows."""
    if not sys.platform.startswith("win"):
        return
    try:
        asyncio.get_running_loop()
        return
    except RuntimeError:
        pass
    try:
        loop = asyncio.get_event_loop()
        if not loop.is_closed():
            return
    except RuntimeError:
        pass
    asyncio.set_event_loop(asyncio.ProactorEventLoop())


def _launch_kwargs() -> dict:
    channel = os.environ.get("WEB_FETCH_BROWSER_CHANNEL", "").strip() or None
    args = [
        "--disable-blink-features=AutomationControlled",
        "--disable-dev-shm-usage",
        "--no-sandbox",
        "--headless=new",
    ]
    launch_kwargs = dict(
        headless=_headless(),
        args=args,
        ignore_default_args=["--enable-automation"],
        proxy=_proxy(),
    )
    if channel:
        launch_kwargs["channel"] = channel
    return launch_kwargs


def _get_browser():
    global _PLAYWRIGHT, _BROWSER
    if _BROWSER is not None:
        return _BROWSER

    from playwright.sync_api import sync_playwright

    from web_fetch.playwright_guard import guard

    with guard:
        if _BROWSER is not None:
            return _BROWSER

        _ensure_thread_event_loop()
        pw = None
        try:
            pw = sync_playwright().start()
            _PLAYWRIGHT = pw
            _BROWSER = pw.chromium.launch(**_launch_kwargs())
            return _BROWSER
        except Exception:
            if pw is not None:
                try:
                    pw.stop()
                except Exception:
                    pass
            _PLAYWRIGHT = None
            _BROWSER = None
            raise


def verify_browser_ready() -> Optional[str]:
    """Launch using the same path as fetch; return an error string on failure."""
    shutdown_browser()
    try:
        _get_browser()
        return None
    except Exception as exc:
        _set_playwright_error(exc)
        return _LAST_PLAYWRIGHT_ERROR
    finally:
        shutdown_browser()


def _cookie_domain(url: str) -> str:
    host = (urlparse(url).hostname or "").lower()
    if not host:
        return ""
    parts = host.split(".")
    if len(parts) >= 2:
        return "." + ".".join(parts[-2:])
    return host


def _apply_seed_cookies(context, url: str, cookies: dict[str, str]) -> None:
    if not cookies:
        return
    domain = _cookie_domain(url)
    if not domain:
        return
    payload = [
        {"name": name, "value": value, "domain": domain, "path": "/"}
        for name, value in cookies.items()
        if name and value is not None
    ]
    if payload:
        context.add_cookies(payload)


def _host(url: str) -> str:
    return urlparse(url).netloc.lower()


def _get_context(browser, host: str):
    with _CONTEXT_LOCK:
        ctx = _CONTEXTS.get(host)
        if ctx is not None:
            return ctx

        if len(_CONTEXTS) >= _MAX_CONTEXTS:
            oldest_host = next(iter(_CONTEXTS))
            try:
                _CONTEXTS.pop(oldest_host).close()
            except Exception:
                pass

        ctx = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            locale="en-GB",
            viewport={"width": 1920, "height": 1080},
            java_script_enabled=True,
        )
        _CONTEXTS[host] = ctx
        return ctx


def _content_ready(html: str) -> bool:
    if not html or looks_like_access_denied(html):
        return False
    if looks_like_akamai_challenge(html):
        return False
    lowered = html.lower()
    return len(html) > 12000 and lowered.count("<a ") >= 8


def _has_akamai_cookies(page) -> bool:
    try:
        names = {c.get("name", "") for c in page.context.cookies()}
        return bool(names & _AKAMAI_COOKIE_NAMES)
    except Exception:
        return False


def _wait_for_akamai(page, *, timeout_sec: float) -> None:
    """Wait for Akamai sensor script, then reload with cookies."""
    deadline = time.time() + timeout_sec
    reloaded = False

    while time.time() < deadline:
        html = page.content() or ""
        if _content_ready(html):
            return

        if _has_akamai_cookies(page) and not reloaded:
            try:
                page.reload(wait_until="domcontentloaded", timeout=30000)
                reloaded = True
                page.wait_for_timeout(2500)
                if _content_ready(page.content() or ""):
                    return
            except Exception as exc:
                logger.debug("Akamai reload failed: %s", exc)

        if looks_like_akamai_challenge(html):
            try:
                page.wait_for_timeout(2000)
            except Exception:
                break
            continue

        if not looks_like_blocked_page(html):
            return

        try:
            page.wait_for_timeout(1500)
        except Exception:
            break

    if not reloaded:
        try:
            page.reload(wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(2500)
        except Exception:
            pass


def fetch_with_playwright(
    url: str,
    *,
    timeout: float = 60.0,
    seed_cookies: Optional[dict[str, str]] = None,
) -> tuple[str, int, str]:
    """
    Fetch *url* using a headless Chromium browser.

    Returns (html, status_code, final_url).
    """
    with _BROWSER_LOCK:
        page = None
        try:
            _set_playwright_error(None)
            browser = _get_browser()
            host = _host(url)
            context = _get_context(browser, host)
            _apply_seed_cookies(context, url, seed_cookies or {})
            page = context.new_page()
            page.add_init_script(_STEALTH_INIT_SCRIPT)

            goto_timeout_ms = int(timeout * 1000)
            response = page.goto(
                url,
                wait_until="domcontentloaded",
                timeout=goto_timeout_ms,
            )
            status_code = response.status if response else 0
            final_url = page.url

            html = page.content() or ""
            if _content_ready(html):
                page.close()
                return html, status_code, final_url

            try:
                page.wait_for_load_state("networkidle", timeout=5000)
            except Exception:
                pass

            _dismiss_consent(page)

            if looks_like_akamai_challenge(html) or looks_like_access_denied(html):
                _wait_for_akamai(page, timeout_sec=min(_challenge_timeout(), timeout))
            else:
                _wait_for_challenge(page, timeout_sec=min(_challenge_timeout(), timeout))

            try:
                page.mouse.wheel(0, 800)
                page.wait_for_timeout(300)
            except Exception:
                pass

            if not _content_ready(page.content() or ""):
                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=goto_timeout_ms)
                    page.wait_for_timeout(2000)
                except Exception:
                    pass

            html = page.content() or ""
            status_code = response.status if response else status_code
            final_url = page.url
            page.close()
            return html, status_code, final_url

        except Exception as exc:
            _set_playwright_error(exc)
            logger.warning("Playwright fetch failed for %s: %s", url, exc)
            if page is not None:
                try:
                    page.close()
                except Exception:
                    pass
            _reset_browser_state()
            return "", 0, url


def _dismiss_consent(page) -> None:
    for selector in _CONSENT_SELECTORS:
        try:
            locator = page.locator(selector).first
            if locator.count() > 0:
                locator.click(timeout=1200)
                page.wait_for_timeout(300)
                return
        except Exception:
            continue


def _wait_for_challenge(page, *, timeout_sec: float) -> None:
    deadline = time.time() + timeout_sec
    last_len = 0

    while time.time() < deadline:
        html = page.content() or ""
        if _content_ready(html):
            return

        lowered = html.lower()
        blocked = looks_like_access_denied(html) or (
            "verify you are human" in lowered or "cf-challenge" in lowered
        )
        growing = len(html) > last_len + 500
        last_len = len(html)

        if not blocked and html.lower().count("<a ") >= 5 and len(html) > 6000:
            return
        if growing and len(html) > 15000:
            return

        try:
            page.wait_for_timeout(1500)
        except Exception:
            break


def get_context_cookies(url: str) -> list[dict]:
    """Return cookies from the persistent browser context for *url*'s host."""
    host = _host(url)
    with _CONTEXT_LOCK:
        ctx = _CONTEXTS.get(host)
        if ctx is None:
            return []
        try:
            return ctx.cookies()
        except Exception:
            return []


def _reset_browser_state() -> None:
    global _PLAYWRIGHT, _BROWSER
    with _CONTEXT_LOCK:
        for ctx in _CONTEXTS.values():
            try:
                ctx.close()
            except Exception:
                pass
        _CONTEXTS.clear()
    if _BROWSER is not None:
        try:
            _BROWSER.close()
        except Exception:
            pass
        _BROWSER = None
    if _PLAYWRIGHT is not None:
        try:
            _PLAYWRIGHT.stop()
        except Exception:
            pass
        _PLAYWRIGHT = None


def shutdown_browser() -> None:
    with _BROWSER_LOCK:
        _reset_browser_state()
