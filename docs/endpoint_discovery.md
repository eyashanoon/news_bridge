# Endpoint Discovery Service

## 1. Service Identity

| Property | Value |
|----------|-------|
| **Path** | `backend/endpoint_discovery/` |
| **Port** | 8004 |
| **Framework** | FastAPI + uvicorn |
| **Entry point** | `backend/endpoint_discovery/service.py` |
| **Core algorithm** | `backend/endpoint_discovery/listing_discoverer.py` |

The Endpoint Discovery service performs **BFS (breadth-first search) crawling** within a registered news domain to identify **article listing pages** suitable for the Site Crawler. It uses a fine-tuned XLM-RoBERTa page classifier to distinguish listing pages from individual articles and other page types.

---

## 2. Purpose in the Pipeline

```
Admin registers Root URL
         │
         ▼
Spring Boot POST /roots/{id}/discover
         │
         ▼
RootDiscoveryService → POST /discover/start {root_url, max_depth}
         │
         ▼
ListingDiscoverer BFS crawl + classification
         │
         ▼
Admin reviews discovered endpoints → POST /roots/{id}/endpoints/bulk
         │
         ▼
Site Crawler begins polling listing endpoints
```

---

## 3. API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness + fetch stack status (curl_cffi, Playwright) |
| POST | `/discover/start` | Start async discovery job → returns `job_id` |
| GET | `/discover/jobs/{job_id}` | Poll job status, logs, result (`log_offset` supported) |
| POST | `/discover` | Synchronous discovery (blocks until complete) |
| POST | `/assess/endpoint` | Test single URL as crawlable listing |

### Async Job Model

Jobs stored in-memory as `DiscoveryJob` objects with background threads:

```python
{
  "job_id": "uuid",
  "status": "running|completed|failed",
  "logs": [...],
  "result": {
    "tree": {...},      # hierarchical URL tree
    "cache": [...],     # all investigated URLs with metadata
    "endpoints": [...]  # classified listing URLs
  }
}
```

Spring Boot polls via `GET /discover/jobs/{jobId}?log_offset=N`.

---

## 4. BFS Discovery Algorithm

**File:** `backend/endpoint_discovery/listing_discoverer.py`

### 4.1 Initialization

```python
discoverer = ListingDiscoverer(root_url, predictor=predictor, max_depth=2)
result = discoverer.discover()
```

1. Normalize root URL (lowercase host, strip fragments, sort query params)
2. Seed BFS queue with root URL
3. Optionally seed from sitemap.xml (up to 80 URLs if root unreachable)

### 4.2 BFS Loop

```
while queue not empty AND depth <= max_depth:
    url = queue.dequeue()
    if url in visited: continue
    visited.add(url)
    
    html = fetch(url) via web_fetch
    if fetch failed: log and continue
    
    classification = predictor.predict(url, html)
    
    record in cache: {url, depth, label, confidence, url_features, ...}
    
    if label == "listing_article":
        add to endpoints list
        extract links from page → enqueue same-domain links at depth+1
    
    polite delay: REQUEST_DELAY = 0.5 seconds
```

### 4.3 Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `REQUEST_TIMEOUT` | 60s | Per-request timeout |
| `REQUEST_DELAY` | 0.5s | Polite crawl delay |
| `MAX_CONTENT_BYTES` | 5 MB | Skip oversized pages |
| `MAX_LINKS_PER_PAGE` | 500 | Cap extracted links |
| `MAX_SITEMAP_SEED_URLS` | 80 | Sitemap seed limit |
| Default `max_depth` | 2 | BFS depth limit |

### 4.4 URL Normalization

Function `normalize_url()`:
- Resolve relative URLs against base
- Strip fragments (`#...`)
- Lowercase hostname
- Remove trailing slash (except root `/`)
- Stable-sort query parameters

Function `same_domain()`:
- Matches exact hostname or subdomain of root

---

## 5. Page Classifier

**Path:** `backend/endpoint_discovery/page_classifier/`

### 5.1 Model Architecture

- **Base model:** XLM-RoBERTa (multilingual)
- **File:** `page_classifier/model.py` — transformer classifier head
- **Checkpoint:** configured in `page_classifier/config.py` → `CHECKPOINT_DIR`

### 5.2 Feature Extraction

**File:** `page_classifier/features.py`

Extracts DOM and URL features from HTML:
- Text length, link density, heading structure
- URL path segments, date patterns
- Schema.org / JSON-LD signals

### 5.3 Inference

**File:** `page_classifier/predict.py` — class `Predictor`

```python
predictor = Predictor()  # load once
result = predictor.predict(url, html)
# Returns: {label, confidence, probabilities}
```

**Labels:**
| Label | Meaning |
|-------|---------|
| `listing_article` | Article index/listing page (crawl target) |
| `content_article` | Individual article page |
| `other` | Navigation, about, video hub, etc. |

### 5.4 Classification Policy

**File:** `page_classifier/classification_policy.py`

- Confidence thresholds per label
- `format_classifier_backup()` — heuristic fallback when ML confidence low
- URL keyword sets for feature hints:
  - `_LISTING_KW`: category, tag, section, archive, feed, search, latest
  - `_ARTICLE_KW`: article, story, post, news, blog
  - `_DATE_PATTERN`: `/YYYY/MM/DD/` in URL path

---

## 6. Listing vs Article Detection Logic

### Primary: ML Classifier

The page classifier assigns each fetched page a label with confidence score. Only `listing_article` pages are added to the endpoints output and have their links expanded in BFS.

### Secondary: URL Feature Heuristics

Function `compute_url_features()` in `listing_discoverer.py`:

```python
url_features = {
    "has_date_pattern": bool(_DATE_PATTERN.search(path)),
    "article_keyword_hits": count of _ARTICLE_KW in path segments,
    "listing_keyword_hits": count of _LISTING_KW in path segments,
    "video_keyword_hits": count of _VIDEO_KW in path,
    "path_depth": number of path segments,
    ...
}
```

These features feed the classifier and support admin assessment UI.

### Assessment Endpoint

`POST /assess/endpoint` accepts `{url, root_url}` and returns classification result without full BFS — used by admin to validate individual URLs before adding as endpoints.

---

## 7. Sitemap Seeding

When root page is unreachable or for faster coverage:

1. Fetch `{root}/sitemap.xml`
2. Parse XML for `<loc>` entries
3. Filter same-domain URLs
4. Exclude non-listing segments (`info`, `story`, `video`, `author`, etc.)
5. Seed BFS queue (cap: 80 URLs)
6. Expand child sitemaps (max 5) from sitemap index files

---

## 8. Output Structure

### Discovery Result

```json
{
  "tree": {
    "url": "https://example.com",
    "label": "listing_article",
    "confidence": 0.92,
    "children": [...]
  },
  "cache": [
    {
      "url": "https://example.com/news",
      "depth": 1,
      "label": "listing_article",
      "confidence": 0.89,
      "url_features": {...},
      "fetched_at": "2026-06-10T12:00:00Z"
    }
  ],
  "endpoints": [
    {
      "url": "https://example.com/news",
      "label": "listing_article",
      "confidence": 0.89,
      "depth": 1
    }
  ]
}
```

### URL Tree

Nested dict representing hierarchical link structure from root, useful for admin visualization of site topology.

---

## 9. Fetch Integration

Uses shared `web_fetch` library:
- Primary: curl_cffi TLS impersonation (Chrome/Safari profiles)
- Fallback: Playwright headless browser for Akamai/JS challenges
- Windows fix: imports `web_fetch/asyncio_policy.py` at startup for ProactorEventLoop compatibility

---

## 10. Spring Boot Integration

**File:** `backend/src/main/java/.../service/RootDiscoveryService.java`

```java
// Start discovery
POST endpoint-discovery:8004/discover/start
  body: { "root_url": "...", "max_depth": 2 }

// Poll progress
GET endpoint-discovery:8004/discover/jobs/{jobId}?log_offset=0

// Single URL assessment
POST endpoint-discovery:8004/assess/endpoint
  body: { "url": "...", "root_url": "..." }
```

Config: `endpoint-discovery.server.base-url` (default `http://localhost:8004`), `max-depth: 2`.

Root verification additionally uses:
- Wayback Machine CDX API (`wayback.api.cdx-url`)
- Wikidata SPARQL for domain trust signals

---

## 11. Shared Usage by Site Crawler

The same page classifier model is loaded by `crawler_server/page_classifier_adapter.py` for **article URL detection** during listing crawls. This ensures consistent classification between discovery and runtime crawling.

---

## 12. Scheduling & Async Behavior

- **No background scheduler** — purely on-demand via HTTP
- Async jobs run in daemon threads per request
- Synchronous `/discover` endpoint blocks until BFS completes
- Jobs are in-memory only (not persisted across restarts)

---

## 13. CLI Usage

```bash
cd backend
python -m endpoint_discovery.listing_discoverer https://www.bbc.com --max-depth 2 --out results.json
```

---

## 14. Inputs and Outputs

### Inputs
- Root domain URL
- Max BFS depth (default 2)
- HTML pages fetched from target domain

### Outputs
- Classified listing endpoint URLs
- Full URL investigation cache with metadata
- Hierarchical URL tree
- Job logs for admin monitoring
