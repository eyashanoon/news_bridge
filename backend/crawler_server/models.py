from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass
class RunStats:
    started_at: datetime
    finished_at: datetime | None = None
    roots_seen: int = 0
    listing_endpoints_seen: int = 0
    links_discovered: int = 0
    links_processed: int = 0
    endpoint_created: int = 0
    endpoint_existing: int = 0
    cache_hits: int = 0
    article_created: int = 0
    cache_endpoint_cached: int = 0
    failed: int = 0

    def as_dict(self) -> dict[str, Any]:
        return {
            "startedAt": self.started_at.isoformat(),
            "finishedAt": self.finished_at.isoformat() if self.finished_at else None,
            "rootsSeen": self.roots_seen,
            "listingEndpointsSeen": self.listing_endpoints_seen,
            "linksDiscovered": self.links_discovered,
            "linksProcessed": self.links_processed,
            "endpointCreated": self.endpoint_created,
            "endpointExisting": self.endpoint_existing,
            "cacheHits": self.cache_hits,
            "articleCreated": self.article_created,
            "cacheEndpointCached": self.cache_endpoint_cached,
            "failed": self.failed,
        }
