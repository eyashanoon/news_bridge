"""Unified HTML fetch with TLS impersonation and browser fallback."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Literal, Optional

import requests
from bs4 import BeautifulSoup

from web_fetch.akamai import looks_like_access_denied, looks_like_akamai_challenge
from web_fetch.browser import (
    fetch_with_playwright,
    get_context_cookies,
    get_last_playwright_error,
)
from web_fetch.cache import HTML_CACHE
from web_fetch.detection import (
    looks_like_blocked_page,
    looks_like_js_shell,
    looks_like_paywall,
    needs_browser_fallback,
    text_block_count,
)
from web_fetch.domain_hints import DOMAIN_HINTS
from web_fetch.ratelimit import DomainRateLimiter, backoff_sleep, should_retry
from web_fetch.robots import ROBOTS

logger = logging.getLogger(__name__)

Profile = Literal["news", "listing", "discovery"]

_CHROME_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

_BASE_HEADERS = {
    "User-Agent": _CHROME_UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
}

_CURL_IMPERSONATE = os.environ.get("WEB_FETCH_IMPERSONATE", "chrome131,chrome120,safari184")
_RATE_LIMITER = DomainRateLimiter()


def _impersonate_profiles() -> list[str]:
    return [p.strip() for p in _CURL_IMPERSONATE.split(",") if p.strip()] or ["chrome120"]


def _blocked_error(html: str, status_code: int, method: str) -> str:
    if looks_like_access_denied(html):
        return (
            f"CDN bot protection (HTTP {status_code}) — "
            "page blocked for automated clients; try WEB_FETCH_BROWSER_CHANNEL=chrome "
            "or WEB_FETCH_PROXY if discovery still misses pages"
        )
    if looks_like_akamai_challenge(html):
        return (
            f"Akamai JS challenge not cleared (HTTP {status_code} via {method}) — "
            "ensure Playwright is installed: python -m playwright install chromium"
        )
    return f"blocked page (HTTP {status_code})"


@dataclass
class FetchResult:
    url: str
    final_url: str
    html: str
    status_code: int
    method: str
    error: Optional[str] = None
    from_cache: bool = False
    paywall: bool = False
    robots_denied: bool = False

    @property
    def ok(self) -> bool:
        return bool(self.html) and not looks_like_blocked_page(self.html) and not self.robots_denied


def _headers(profile: Profile) -> dict[str, str]:
    return dict(_BASE_HEADERS)


def _decode_response(response) -> str:
    content_encoding = (response.headers.get("content-encoding") or "").lower()
    if "br" in content_encoding:
        try:
            import brotli

            return brotli.decompress(response.content).decode("utf-8", errors="replace")
        except Exception:
            pass
    return response.text or ""


def _fetch_curl_cffi(
    url: str,
    *,
    profile: Profile,
    timeout: float,
    impersonate: str,
    cookies: Optional[dict[str, str]] = None,
) -> tuple[str, int, str, dict[str, str]]:
    from curl_cffi import requests as curl_requests

    proxy = os.environ.get("WEB_FETCH_PROXY", "").strip() or None
    proxies = {"http": proxy, "https": proxy} if proxy else None

    response = curl_requests.get(
        url,
        headers=_headers(profile),
        impersonate=impersonate,
        timeout=timeout,
        allow_redirects=True,
        proxies=proxies,
        cookies=cookies or None,
    )
    html = _decode_response(response)
    final_url = str(getattr(response, "url", url) or url)
    cookies = {k: str(v) for k, v in response.cookies.items()}
    return html, int(response.status_code), final_url, cookies


def _cookies_from_playwright(url: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for cookie in get_context_cookies(url):
        name = cookie.get("name")
        value = cookie.get("value")
        if name and value is not None:
            out[str(name)] = str(value)
    return out


def _fetch_requests(url: str, *, profile: Profile, timeout: float) -> tuple[str, int, str]:
    proxy = os.environ.get("WEB_FETCH_PROXY", "").strip() or None
    proxies = {"http": proxy, "https": proxy} if proxy else None

    response = requests.get(
        url,
        headers=_headers(profile),
        timeout=timeout,
        allow_redirects=True,
        proxies=proxies,
    )
    html = _decode_response(response)
    return html, int(response.status_code), str(response.url or url)


def _content_usable(html: str) -> bool:
    return bool(html) and not looks_like_blocked_page(html)


def _fetch_http_once(
    url: str, *, profile: Profile, timeout: float
) -> tuple[str, int, str, str, dict[str, str]]:
    best_html = ""
    best_status = 0
    best_final = url
    best_method = "curl_cffi"
    best_imp = _impersonate_profiles()[0]
    best_cookies: dict[str, str] = {}

    for impersonate in _impersonate_profiles():
        try:
            html, status, final_url, cookies = _fetch_curl_cffi(
                url, profile=profile, timeout=timeout, impersonate=impersonate
            )
        except ImportError:
            logger.debug("curl_cffi not installed, falling back to requests")
            break
        except Exception as exc:
            logger.debug("curl_cffi (%s) failed for %s: %s", impersonate, url, exc)
            continue

        if html and not looks_like_blocked_page(html):
            return html, status, final_url, f"curl_cffi:{impersonate}", cookies

        # Prefer Akamai challenge shells over hard CDN deny pages (browser can clear the former).
        deny = looks_like_access_denied(html or "")
        best_deny = looks_like_access_denied(best_html or "")
        if html and (not deny and best_deny or len(html) > len(best_html)):
            best_html, best_status, best_final, best_imp, best_cookies = (
                html,
                status,
                final_url,
                impersonate,
                cookies,
            )

    if best_html:
        return best_html, best_status, best_final, f"curl_cffi:{best_imp}", best_cookies

    try:
        html, status, final_url = _fetch_requests(url, profile=profile, timeout=timeout)
        return html, status, final_url, "requests", {}
    except requests.RequestException as exc:
        return "", 0, url, f"requests:{exc}", {}


def _fetch_http(
    url: str, *, profile: Profile, timeout: float
) -> tuple[str, int, str, str, dict[str, str]]:
    html = ""
    status_code = 0
    final_url = url
    method = "curl_cffi"
    cookies: dict[str, str] = {}

    max_attempts = int(os.environ.get("WEB_FETCH_MAX_RETRIES", "3")) + 1
    for attempt in range(max_attempts):
        html, status_code, final_url, method, cookies = _fetch_http_once(
            url, profile=profile, timeout=timeout
        )
        if isinstance(method, str) and method.startswith("requests:"):
            return html, status_code, final_url, method, cookies
        if not should_retry(status_code, attempt):
            break
        backoff_sleep(attempt, status_code=status_code)

    return html, status_code, final_url, method, cookies


def _browser_improves(fast_html: str, browser_html: str) -> bool:
    if not browser_html or looks_like_blocked_page(browser_html):
        return False
    if looks_like_blocked_page(fast_html):
        return True

    fast_soup = BeautifulSoup(fast_html or "", "lxml")
    browser_soup = BeautifulSoup(browser_html, "lxml")
    return text_block_count(browser_soup) > text_block_count(fast_soup)


def _result_from_cache(url: str, entry) -> FetchResult:
    paywall = looks_like_paywall(entry.html)
    return FetchResult(
        url=url,
        final_url=entry.final_url,
        html=entry.html,
        status_code=entry.status_code,
        method=entry.method,
        from_cache=True,
        paywall=paywall,
    )


def fetch_html(
    url: str,
    *,
    profile: Profile = "news",
    timeout: float = 30.0,
    allow_browser: bool = True,
    use_cache: bool = True,
    respect_robots: bool = True,
) -> FetchResult:
    """
    Fetch HTML from *url* using TLS impersonation, then Playwright if blocked.

    Environment variables:
      WEB_FETCH_PROXY, WEB_FETCH_HEADLESS, WEB_FETCH_BROWSER_CHANNEL
      WEB_FETCH_CACHE_TTL_SECONDS, WEB_FETCH_MIN_DELAY, WEB_FETCH_RESPECT_ROBOTS
    """
    if use_cache:
        cached = HTML_CACHE.get(url)
        if cached is not None:
            return _result_from_cache(url, cached)

    if respect_robots and not ROBOTS.allowed(url):
        return FetchResult(
            url=url,
            final_url=url,
            html="",
            status_code=0,
            method="robots",
            error="blocked by robots.txt",
            robots_denied=True,
        )

    _RATE_LIMITER.wait(url)

    html, status_code, final_url, method, http_cookies = _fetch_http(
        url, profile=profile, timeout=timeout
    )
    error: Optional[str] = None
    if isinstance(method, str) and method.startswith("requests:"):
        error = method.split(":", 1)[1]
        method = "requests"

    fast_domain = DOMAIN_HINTS.skip_browser_probe(url)
    use_browser = allow_browser and needs_browser_fallback(
        html,
        status_code,
        skip_if_fast_domain=fast_domain,
    )
    # Hard CDN deny pages are not cleared by headless browsers (e.g. Sky News sections).
    if looks_like_access_denied(html or ""):
        use_browser = False
    if use_browser and DOMAIN_HINTS.prefer_browser(url) and allow_browser:
        use_browser = True
    elif fast_domain and status_code < 400 and html and not looks_like_blocked_page(html):
        use_browser = False

    if use_browser:
        seed_cookies = http_cookies if looks_like_akamai_challenge(html or "") else None
        browser_html, browser_status, browser_final = fetch_with_playwright(
            url,
            timeout=max(timeout, 60.0),
            seed_cookies=seed_cookies,
        )
        if browser_html and (
            not html
            or _browser_improves(html, browser_html)
            or looks_like_blocked_page(html)
            or looks_like_js_shell(html, BeautifulSoup(html or "", "lxml"))
        ):
            html = browser_html
            status_code = browser_status or status_code
            final_url = browser_final or final_url
            method = "playwright"

        # After browser clears Akamai cookies, retry fast HTTP with those cookies.
        if html and _content_usable(html):
            pass
        elif browser_html or looks_like_akamai_challenge(html or ""):
            pw_cookies = _cookies_from_playwright(url)
            if pw_cookies:
                for impersonate in _impersonate_profiles():
                    try:
                        retry_html, retry_status, retry_final = _fetch_curl_cffi(
                            url,
                            profile=profile,
                            timeout=timeout,
                            impersonate=impersonate,
                            cookies=pw_cookies,
                        )
                    except Exception:
                        continue
                    if retry_html and not looks_like_blocked_page(retry_html):
                        html = retry_html
                        status_code = retry_status
                        final_url = retry_final
                        method = f"curl_cffi+cookies:{impersonate}"
                        break

        if looks_like_blocked_page(html or "") and not browser_html and allow_browser:
            pw_error = get_last_playwright_error()
            if pw_error:
                error = f"Playwright browser fetch failed: {pw_error}"
            else:
                error = (
                    "Playwright browser fetch returned empty — "
                    "run: python -m playwright install chromium"
                )

    paywall = looks_like_paywall(html) if html else False

    if not html and error:
        DOMAIN_HINTS.record_failure(url)
        return FetchResult(
            url=url,
            final_url=final_url,
            html="",
            status_code=status_code,
            method=method,
            error=error,
        )

    if looks_like_blocked_page(html):
        error = error or _blocked_error(html, status_code, method)
        DOMAIN_HINTS.record_failure(url)
    elif html and method:
        DOMAIN_HINTS.record_success(url, method)

    result = FetchResult(
        url=url,
        final_url=final_url,
        html=html,
        status_code=status_code,
        method=method,
        error=error,
        paywall=paywall,
    )

    if use_cache and html and result.ok:
        HTML_CACHE.put(
            url,
            html=html,
            final_url=final_url,
            status_code=status_code,
            method=method,
        )

    return result


def fetch_soup(
    url: str,
    *,
    profile: Profile = "news",
    timeout: float = 30.0,
    allow_browser: bool = True,
    use_cache: bool = True,
    respect_robots: bool = True,
) -> tuple[Optional[BeautifulSoup], FetchResult]:
    result = fetch_html(
        url,
        profile=profile,
        timeout=timeout,
        allow_browser=allow_browser,
        use_cache=use_cache,
        respect_robots=respect_robots,
    )
    if not result.html:
        return None, result
    if looks_like_blocked_page(result.html):
        return None, result
    return BeautifulSoup(result.html, "lxml"), result
