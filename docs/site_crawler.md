# Site Crawler Service

## 1. Service Identity

| Property | Value |
|----------|-------|
| **Path** | `backend/crawler_server/` |
| **Port** | 8000 |
| **Framework** | FastAPI + uvicorn |
| **Entry point** | `backend/crawler_server/main.py` |
| **Title** | News Collector Server v2.0.0 |

The Site Crawler is a continuously running Python microservice that polls news-site **listing endpoints**, discovers article URLs, classifies them, extracts structured content, and persists results to the Spring Boot backend. It also hosts an embedded post-processing pipeline for classification and tagging.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Application                       │
│  Control API (/health, /control/*, /logs)                   │
├─────────────────────────────────────────────────────────────┤
│  EndpointScheduler (N worker threads)                       │
│  ├── Priority queue over active endpoints                   │
│  └── Each worker → CrawlerService.crawl_endpoint()          │
├─────────────────────────────────────────────────────────────┤
│  APScheduler BackgroundScheduler                            │
│  └── Every 10s → post_processor.process_pending_posts()     │
├─────────────────────────────────────────────────────────────┤
│  BackendClient (JWT auth → Spring Boot :8080)               │
└─────────────────────────────────────────────────────────────┘
         │              │              │
         ▼              ▼              ▼
    web_fetch      page_classifier   extractor
    (fetch HTML)   (is_article?)     (extract_article)
```

---

## 3. Scheduling System

### 3.1 EndpointScheduler Design

**File:** `backend/crawler_server/main.py` — class `EndpointScheduler`

The scheduler maintains **N concurrent worker threads** (`CRAWLER_NUM_CHANNELS`, default 3). Workers never idle when work exists: upon completing a crawl, a worker immediately picks the next highest-priority endpoint.

### 3.2 Priority Formula

```
priority = production_score + staleness_bonus

production_score = EMA(articles_found_per_crawl)   // seeded from backend crawlScore
staleness_bonus  = sqrt(hours_since_last_crawl) × staleness_weight

first_crawl_ever → priority = 9999 + production_score
```

**Parameters** (from `settings.py`):

| Env Variable | Default | Role |
|--------------|---------|------|
| `CRAWLER_NUM_CHANNELS` | 3 | Worker thread count |
| `CRAWLER_SCORE_ALPHA` | 0.3 | EMA smoothing factor |
| `CRAWLER_STALENESS_WEIGHT` | 1.0 | Staleness multiplier (admin adjustable 0.1–10.0 via `/control/interval`) |

### 3.3 Worker Lifecycle

1. Worker waits on `Condition` variable when pool empty or paused
2. `_pick_next()` selects highest-priority endpoint not in `_active` set
3. Worker calls `CrawlerService.crawl_endpoint(root_id, endpoint_id, url)`
4. Updates EMA score: `new_score = alpha × articles_found + (1-alpha) × old_score`
5. Records `_last_crawled_time`, increments `_crawl_counts`
6. PATCHes backend with crawl stats
7. Signals condition variable for waiting workers

### 3.4 Session Statistics

Tracked per session: `_total_crawls`, `_total_articles`, per-channel status display.

---

## 4. Crawl Pipeline (CrawlerService)

**File:** `backend/crawler_server/crawler_service.py`

### 4.1 Per-Endpoint Algorithm

```
1. Fetch listing page HTML via web_fetch
2. Extract all <a href> links (same-domain filter optional)
3. Bulk-load cached URLs: GET /cache-endpoints/urls-by-source?endpointId=X
4. Filter to new_links = all_links - cached_urls
5. For each new_link:
   a. _process_candidate(root_id, endpoint_id, url)
6. Return count of articles_created
```

### 4.2 Candidate Processing

**Method:** `_process_candidate()`

```
1. Fetch candidate page HTML
2. page_classifier_adapter.is_article(url, html) → boolean
3. ALWAYS save to cache (POST /cache-endpoints) regardless of outcome
4. If NOT article → return 0
5. extract_article(url, html=html) → structured content
6. POST /articles with title, blocks, media, endpoint_id
7. Return 1 if created
```

### 4.3 Link Extraction

Uses BeautifulSoup to parse listing HTML. Respects `CRAWLER_RESTRICT_SAME_DOMAIN` setting via `vv_adapter.same_host()`.

### 4.4 Error Handling

- Per-link try/except with traceback logging
- Cache bulk-load failure → proceed without cache filter (degraded mode)
- Failed links logged but do not halt endpoint crawl

---

## 5. Page Classification Integration

**File:** `backend/crawler_server/page_classifier_adapter.py`

Wraps `endpoint_discovery/page_classifier/Predictor`:

- Model: XLM-RoBERTa fine-tuned for page type classification
- Labels: `listing_article`, `content_article`, `other`
- `is_article()` returns true for `content_article` above confidence threshold
- Uses `classification_policy.py` thresholds and `format_classifier_backup` fallback

**Note:** Legacy `checker/url_model` sklearn classifier is NOT used in the active path.

---

## 6. Content Extraction Integration

**File:** `backend/extractor/content_model/extract_dl.py`

Called via `from extractor import extract_article` in `main.py`.

Returns structured dict:
- `title` — extracted headline
- `blocks` — list of text/image/video blocks with ordering
- `url` — source URL

See `web_extractor.md` for extraction internals.

---

## 7. Backend Integration

**File:** `backend/crawler_server/backend_client.py`

### 7.1 Authentication

```python
POST /auth/admin/login
{"email": BACKEND_EMAIL, "password": BACKEND_PASSWORD}
→ JWT stored for subsequent requests
```

Default credentials: bootstrap `crawler-service@news.local` account.

### 7.2 API Calls

| Operation | Endpoint |
|-----------|----------|
| List roots | `GET /roots` |
| List endpoints | `GET /endpoints?rootId=X` |
| Bulk cached URLs | `GET /cache-endpoints/urls-by-source?endpointId=X` |
| Create article | `POST /articles` |
| Save cache entry | `POST /cache-endpoints` |
| Update crawl stats | `PATCH /endpoints/{id}/crawl-stats` |

---

## 8. Post-Processing Pipeline

**File:** `backend/post_processor.py`  
**Trigger:** APScheduler every 10 seconds in `main.py`

```
1. SELECT posts WHERE tags_extracted = 0 LIMIT batch_size
2. For each post:
   a. Load article text from DB
   b. Classify category (HuggingFace model from classifier_service/final_mode_V2)
   c. Extract tags (BERT-NER + YAKE, EN/AR)
   d. UPDATE posts SET label, lang, tags_extracted = 1
   e. INSERT INTO post_tags
```

Runs in-process with the crawler (not a separate HTTP service call).

---

## 9. Control API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Scheduler + channel status |
| POST | `/run-now` | Reset staleness timers for immediate re-crawl |
| GET | `/last-run` | Session crawl totals |
| GET | `/control/status` | Full scheduler state (channels, scores, pending) |
| POST | `/control/start` | Resume paused scheduler |
| POST | `/control/stop` | Pause scheduler |
| POST | `/control/restart` | Full restart + reload endpoints |
| POST | `/control/run-endpoint` | Manual one-shot crawl by `endpointId` |
| POST | `/control/interval` | Set staleness weight (1–100 → 0.1–10.0) |
| GET | `/logs` | Ring-buffer logs (max 500, optional `limit`, `since`) |
| DELETE | `/logs` | Clear log buffer |

Admin UI proxies these via `CrawlerAdminService` in Spring Boot.

---

## 10. Configuration

**File:** `backend/crawler_server/settings.py`

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_BASE_URL` | `http://localhost:8080` | Spring Boot URL |
| `BACKEND_EMAIL` | crawler service account | Auth email |
| `BACKEND_PASSWORD` | from bootstrap config | Auth password |
| `CRAWLER_NUM_CHANNELS` | 3 | Worker threads |
| `CRAWLER_SCORE_ALPHA` | 0.3 | EMA alpha |
| `CRAWLER_STALENESS_WEIGHT` | 1.0 | Staleness multiplier |
| `CRAWLER_REQUEST_TIMEOUT_SECONDS` | 60 | HTTP timeout |
| `CRAWLER_RESTRICT_SAME_DOMAIN` | true | Same-host link filter |

---

## 11. Logging

Ring buffer of 500 entries with `{ts, level, msg}` structure. Custom `_DequeHandler` attached to `crawler` logger. Accessible via `/logs` API for admin monitoring.

---

## 12. Inputs and Outputs

### Inputs
- Active endpoints from Spring Boot (listing URLs)
- HTML pages fetched via `web_fetch`
- ML models: page classifier, content extractor, classifier, NER

### Outputs
- Articles persisted to MySQL via `POST /articles`
- Cache entries via `POST /cache-endpoints`
- Classified/tagged posts via direct MySQL writes
- Crawl statistics via `PATCH /endpoints/{id}/crawl-stats`
- Operational logs via `/logs` API

---

## 13. Failure & Retry Behavior

| Failure | Behavior |
|---------|----------|
| Listing fetch fails | Log error, return 0 articles, move to next endpoint |
| Single link processing fails | Log traceback, continue with remaining links |
| Backend auth fails | Exception propagates, worker may retry on next cycle |
| Classifier model unavailable | `SKIP_MODEL_LOAD=1` enables keyword heuristic fallback |
| Cache bulk-load fails | Degraded mode: process all links without dedup filter |

No explicit HTTP retry with backoff for fetches; `web_fetch` handles rate limiting and Playwright fallback internally.
