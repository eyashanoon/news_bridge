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

                    discovered = self._extract_links(listing_url)
                    stats.links_discovered += len(discovered)
                    self._log(f"Endpoint {listing_url}: discovered {len(discovered)} link(s)")

                    for link in discovered[: settings.crawler_max_links_per_listing]:
                        stats.links_processed += 1
                        try:
                            self._process_candidate(root_id, listing_endpoint_id, link, stats)
                        except Exception as ex:
                            stats.failed += 1
                            self._log(f"[ERROR] failed to process {link}: {type(ex).__name__}: {ex}")
                            traceback.print_exc()
        finally:
            stats.finished_at = datetime.utcnow()

        return stats.as_dict()

    def _process_candidate(self, root_id: int, source_endpoint_id: int, candidate_url: str, stats: RunStats) -> None:
        cached = self.backend.get_cache_endpoint_by_url(source_endpoint_id, candidate_url)
        if cached is not None:
            stats.cache_hits += 1
            self._log(f"[CACHE HIT] skip: {candidate_url}")
            return

        is_article = self.is_article_fn(candidate_url)
        if not is_article:
            self._log(f"[SKIP] not an article: {candidate_url}")
            self.backend.create_cache_endpoint(
                url=candidate_url,
                result="UNKNOWN",
                source_endpoint_id=source_endpoint_id,
            )
            stats.cache_endpoint_cached += 1
            return

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
        flattened_text = "\n\n".join(text_parts)
        if not flattened_text:
            flattened_text = title or candidate_url

        article_blocks = []
        for index, item in enumerate(content_items, start=1):
            raw_type = str(item.get("type") or "text").strip().upper()
            if raw_type not in {"TEXT", "IMAGE", "VIDEO", "AUDIO", "ATTACHMENT", "OTHER"}:
                raw_type = "OTHER"
            media_url = str(item.get("src") or item.get("content") or "")
            text_content = str(item.get("text") or item.get("content") or "")
            article_blocks.append(
                {
                    "sortOrder": int(item.get("order") or index),
                    "blockType": raw_type,
                    "textContent": text_content if raw_type == "TEXT" else "",
                    "mediaUrl": media_url if raw_type != "TEXT" else "",
                    "altText": str(item.get("alt") or ""),
                    "score": float(item.get("score") or 0.0),
                }
            )

        created_cache = self.backend.create_cache_endpoint(
            url=candidate_url,
            result="ARTICLE",
            source_endpoint_id=source_endpoint_id,
            extracted_text=flattened_text[:20000],
            extracted_title=title[:2000],
            extracted_content_json=json.dumps(article, ensure_ascii=False)[:50000],
        )
        if created_cache is not None:
            stats.cache_endpoint_cached += 1

        if created_cache is not None:
            self.backend.create_article_record(
                {
                    "url": candidate_url,
                    "title": title,
                    "text": flattened_text[:50000],
                    "endpointId": source_endpoint_id,
                    "cacheEndpointId": int(created_cache["id"]),
                    "blocks": article_blocks,
                }
            )
            stats.article_created += 1

    def _extract_links(self, page_url: str) -> list[str]:
        response = requests.get(page_url, timeout=settings.crawler_request_timeout_seconds)
        response.raise_for_status()

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
