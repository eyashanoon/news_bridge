from __future__ import annotations

import json
import traceback
from datetime import datetime
from typing import Iterable
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup

from backend_client import BackendClient
from models import RunStats
from settings import settings
from vv_adapter import same_host

# Browser-like headers so listing pages don't block the crawler
_REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate",
}


class CrawlerService:
    def __init__(self, backend: BackendClient, is_article_fn, extract_article_fn, log_fn=None) -> None:
        self.backend = backend
        self.is_article_fn = is_article_fn
        self.extract_article_fn = extract_article_fn
        self._log = log_fn or (lambda msg: print(msg, flush=True))

    def run_once(self) -> dict:
        stats = RunStats(started_at=datetime.utcnow())
        try:
            roots = self.backend.get_roots()
            stats.roots_seen = len(roots)
            self._log(f"Found {stats.roots_seen} root(s) to crawl")

            for root in roots:
                root_id = int(root["id"])
                endpoints = self.backend.get_endpoints(root_id)
                stats.listing_endpoints_seen += len(endpoints)
                self._log(f"Root #{root_id}: {len(endpoints)} listing endpoint(s)")

                for endpoint in endpoints:
                    listing_endpoint_id = int(endpoint["id"])
                    listing_url = str(endpoint["url"])
                    created = self.crawl_endpoint(root_id, listing_endpoint_id, listing_url)
                    stats.article_created += created
        finally:
            stats.finished_at = datetime.utcnow()

        return stats.as_dict()

    def crawl_endpoint(self, root_id: int, endpoint_id: int, listing_url: str) -> int:
        """
        Crawl a single listing endpoint.

        Process:
          1. Fetch the listing page and extract all hrefs.
          2. Bulk-load all URLs already cached for this endpoint (one HTTP call).
          3. Keep only URLs NOT in the cache.
          4. For each new URL: classify → if article, extract and persist.
          5. Every processed URL (article or not) is saved to the cache with a
             timestamp so it is skipped on the next crawl.

        Returns the number of new articles created.
        """
        all_links = self._extract_links(listing_url)
        if not all_links:
            self._log(f"[EP#{endpoint_id}] No links extracted from {listing_url}")
            return 0

        self._log(f"[EP#{endpoint_id}] Extracted {len(all_links)} link(s) from {listing_url}")

        try:
            cached_urls: set[str] = self.backend.get_all_cached_urls_for_endpoint(endpoint_id)
        except Exception as ex:
            self._log(f"[EP#{endpoint_id}] Cache bulk-load failed ({ex}), skipping cache filter")
            cached_urls = set()

        new_links = [url for url in all_links if url not in cached_urls]
        self._log(
            f"[EP#{endpoint_id}] {len(cached_urls)} cached  |  "
            f"{len(new_links)} new link(s) to process"
        )

        if not new_links:
            return 0

        articles_created = 0
        for link in new_links:
            cached_urls.add(link)
            try:
                created = self._process_candidate(root_id, endpoint_id, link)
                articles_created += created
            except Exception as ex:
                self._log(f"[ERROR] {link}: {type(ex).__name__}: {ex}")
                traceback.print_exc()

        return articles_created

    def _process_candidate(self, root_id: int, source_endpoint_id: int, candidate_url: str) -> int:
        """
        Classify and optionally extract a single candidate URL.
        The URL is guaranteed to NOT be in the cache already.
        Saves the URL to the cache regardless of the outcome (with timestamp).
        Returns 1 if a new article was created, else 0.
        """
        is_article = self.is_article_fn(candidate_url)
        if not is_article:
            self._log(f"[SKIP] not an article: {candidate_url}")
            try:
                self.backend.create_cache_endpoint(
                    url=candidate_url,
                    result="UNKNOWN",
                    source_endpoint_id=source_endpoint_id,
                )
            except Exception:
                pass
            return 0

        self._log(f"[ARTICLE] extracting: {candidate_url}")
        article = self.extract_article_fn(candidate_url)
        content_items = article.get("content", []) or []
        title = (article.get("title") or "").strip() or candidate_url
        self._log(f"[ARTICLE] extracted: \"{title[:80]}\" ({len(content_items)} blocks)")

        text_parts = [
            str(item.get("text", "")).strip()
            for item in content_items
            if item.get("type") == "text" and str(item.get("text", "")).strip()
        ]
        flattened_text = "\n\n".join(text_parts) or title or candidate_url

        article_blocks = []
        for index, item in enumerate(content_items, start=1):
            raw_type = str(item.get("type") or "text").strip().upper()
            if raw_type not in {"TEXT", "IMAGE", "VIDEO", "AUDIO", "ATTACHMENT", "OTHER"}:
                raw_type = "OTHER"
            media_url = str(item.get("src") or item.get("content") or "")
            text_content = str(item.get("text") or item.get("content") or "")
            article_blocks.append({
                "sortOrder": int(item.get("order") or index),
                "blockType": raw_type,
                "textContent": text_content if raw_type == "TEXT" else "",
                "mediaUrl": media_url if raw_type != "TEXT" else "",
                "altText": str(item.get("alt") or ""),
                "score": float(item.get("score") or 0.0),
            })

        created_cache = self.backend.create_cache_endpoint(
            url=candidate_url,
            result="ARTICLE",
            source_endpoint_id=source_endpoint_id,
            extracted_text=flattened_text[:20000],
            extracted_title=title[:2000],
            extracted_content_json=json.dumps(article, ensure_ascii=False)[:50000],
        )

        if created_cache is not None:
            self.backend.create_article_record({
                "url": candidate_url,
                "title": title,
                "text": flattened_text[:50000],
                "endpointId": source_endpoint_id,
                "cacheEndpointId": int(created_cache["id"]),
                "blocks": article_blocks,
            })
            return 1

        return 0

    def _extract_links(self, page_url: str) -> list[str]:
        """Fetch a listing page and return all normalised absolute hrefs."""
        try:
            response = requests.get(
                page_url,
                headers=_REQUEST_HEADERS,
                timeout=settings.crawler_request_timeout_seconds,
                allow_redirects=True,
            )
            response.raise_for_status()
        except Exception as ex:
            self._log(f"[ERROR] Failed to fetch listing page {page_url}: {ex}")
            return []

        soup = BeautifulSoup(response.text, "html.parser")
        hrefs = self._normalize_links(page_url, [a.get("href") for a in soup.select("a[href]")])
        return list(hrefs)

    def _normalize_links(self, base_url: str, links: Iterable[str | None]) -> set[str]:
        out: set[str] = set()
        for link in links:
            if not link:
                continue
            full = urljoin(base_url, link).split("#", 1)[0].strip()
            parsed = urlparse(full)
            if parsed.scheme not in {"http", "https"}:
                continue
            if settings.crawler_restrict_same_domain and not same_host(base_url, full):
                continue
            out.add(full)
        return out
