# Telegram Crawler Service

## 1. Service Identity

| Property | Value |
|----------|-------|
| **Path** | `backend/telegram_crawler/` |
| **Port** | 8200 |
| **Framework** | FastAPI + uvicorn |
| **Entry point** | `backend/telegram_crawler/main.py` |
| **Scheduler** | `backend/telegram_crawler/channel_scheduler.py` |

The Telegram Crawler continuously polls active Telegram channels registered in the Spring Boot backend, extracts messages via MTProto (Telethon) with web-scraper fallback, and bulk-submits posts to the API.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Application                       │
│  Control API (/health, /control/*, /search, /logs)          │
├─────────────────────────────────────────────────────────────┤
│  ChannelScheduler (N worker threads)                        │
│  ├── Priority queue with waitlist rotation                  │
│  ├── Min cooldown per channel                               │
│  └── MTProto lock (serialized Telethon access)              │
├─────────────────────────────────────────────────────────────┤
│  Background reload thread (every 120s)                      │
│  └── Refresh active channels from backend                   │
├─────────────────────────────────────────────────────────────┤
│  BackendClient (JWT → Spring Boot :8080)                    │
└─────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
  telegram_client.py              scraper.py
  (Telethon MTProto)              (web fallback)
```

---

## 3. Telegram API Integration

### 3.1 Primary: MTProto via Telethon

**File:** `backend/telegram_crawler/telegram_client.py`

- Uses Telethon library with user session
- Session file path: `TELEGRAM_SESSION_PATH` (configured in settings)
- Runs in dedicated asyncio event loop (isolated from uvicorn)
- Protected by `_mtproto_lock` in scheduler (one MTProto operation at a time)

**Setup:** `backend/telegram_crawler/setup_session.py` — interactive session bootstrap requiring `TELEGRAM_API_ID` and `TELEGRAM_API_HASH`.

```python
posts = telegram_client.fetch_posts(
    username,
    since=None,
    limit=settings.max_posts_per_channel,
)
```

Returns list of post dicts with: message_id, text, media URLs, view_count, timestamp.

### 3.2 Fallback: Web Scraper

**File:** `backend/telegram_crawler/scraper.py`

When MTProto returns `None` (session unavailable, rate limit, channel restricted):

```python
posts = scrape_channel(
    username,
    max_posts=settings.max_posts_per_channel,
    timeout=settings.request_timeout_seconds,
    since=since_dt,
)
```

Scrapes public `t.me/s/{username}` web preview pages.

### 3.3 Channel Search

`GET /search?q=` — searches channels via Telethon or web scraper for admin onboarding UI.

---

## 4. Channel Scheduling Logic

**File:** `backend/telegram_crawler/channel_scheduler.py` — class `ChannelScheduler`

Mirrors Site Crawler architecture with Telegram-specific extensions.

### 4.1 Priority Formula

```
priority = backend_crawlPriority + local_EMA_score + staleness_bonus

staleness_bonus = sqrt(hours_since_last_crawl) × staleness_weight

never_crawled → priority = 9999 + backend_priority + local_score
```

`crawlPriority` computed server-side by `ChannelScoringService` in Spring Boot.

### 4.2 Minimum Cooldown

```python
_seconds_until_ready(cid) = max(0, min_cooldown - elapsed_since_last_crawl)
```

Default: `TELEGRAM_MIN_COOLDOWN_SECONDS` (minimum 30 seconds enforced).

Channels not past cooldown are excluded from `_pick_next()` available set.

### 4.3 Waitlist System

```python
WAITLIST_THRESHOLD = 2.0
WAITLIST_ROTATION_EVERY = 5  # pick waitlist channel every 5 priority picks
```

- Channels with low priority score AND `totalCrawls > 3` enter waitlist
- Waitlist rotation prevents starvation of low-priority channels
- Waitlist sorted by oldest `last_crawled_time` first

### 4.4 Anti-Consecutive Rule

```python
if cid == self._last_global_channel and len(available) > 1:
    continue  # skip same channel twice in a row when alternatives exist
```

---

## 5. Message Extraction Pipeline

**File:** `backend/telegram_crawler/crawler_service.py` — class `ChannelCrawlService`

### 5.1 Per-Channel Algorithm

```
1. Determine since_dt from channel.lastCrawledAt (default: 3 minutes ago)
2. Attempt MTProto fetch via telegram_client.fetch_posts()
3. If None → fallback to scraper.scrape_channel()
4. Attach channelId to each post dict
5. Compute avg_view_count for stats
6. Bulk submit via backend.create_posts_bulk(posts)
7. Return stats: {posts_scraped, posts_created, posts_skipped, errors}
```

### 5.2 Incremental Crawling

- First crawl: fetches posts from last 3 minutes
- Subsequent crawls: uses `lastCrawledAt` timestamp as watermark
- Limit: `TELEGRAM_MAX_POSTS_PER_CHANNEL` per crawl cycle

### 5.3 Post Payload Structure

Each post submitted to backend:

```json
{
  "channelId": 123,
  "messageId": 45678,
  "content": "Post text...",
  "mediaUrl": "https://...",
  "viewCount": 1500,
  "postedAt": "2026-06-10T12:00:00Z"
}
```

Unique constraint: `(channelId, messageId)` in `telegram_posts` table.

---

## 6. Batching and Backend Submission

**File:** `backend/telegram_crawler/backend_client.py`

### 6.1 Authentication

```python
POST /auth/admin/login
# Uses telegram-crawler-service@news.local bootstrap account
```

### 6.2 API Calls

| Operation | Endpoint |
|-----------|----------|
| Load active channels | `GET /api/telegram/channels/active` |
| Bulk create posts | `POST /api/telegram/posts/bulk` |
| Update crawl stats | `PATCH /api/telegram/channels/{id}/crawl-stats` |

### 6.3 Bulk Submission

All posts from a channel crawl submitted in single HTTP request. Backend deduplicates by message ID; returns counts of created vs skipped.

---

## 7. Channel Reload

Background daemon thread reloads channel list every `TELEGRAM_CHANNEL_RELOAD_SECONDS` (default 120):

```
1. GET /api/telegram/channels/active
2. Merge into scheduler._pending dict
3. Remove deactivated channels
4. Seed scores from backend crawlScore field
```

Also triggered manually via `POST /control/reload`.

---

## 8. Control API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Scheduler + Telegram API readiness |
| POST | `/run-now` | Trigger immediate crawl cycle |
| GET | `/search` | Channel search (`?q=`) |
| GET | `/control/status` | Worker/channel queue state |
| POST | `/control/start` | Resume scheduler |
| POST | `/control/stop` | Pause scheduler |
| POST | `/control/restart` | Restart scheduler |
| POST | `/control/reload` | Reload channels from backend |
| POST | `/control/interval` | Set min cooldown (minutes) |
| POST | `/control/staleness` | Set staleness weight |
| GET/DELETE | `/logs` | Log buffer |

Proxied by `TelegramCrawlerAdminService` in Spring Boot.

---

## 9. Error Handling and Retries

| Scenario | Behavior |
|----------|----------|
| MTProto unavailable | Automatic fallback to web scraper |
| Scraper returns empty | Return zero stats, update crawl timestamp |
| Bulk submit partial failure | Log errors, count in stats.errors |
| Backend auth failure | Exception logged, worker retries next cycle |
| Channel not found | Log warning, skip channel |
| Rate limiting | Cooldown enforced; channel waits until ready |

No exponential backoff; scheduling naturally retries on next priority cycle.

---

## 10. Configuration

**File:** `backend/telegram_crawler/settings.py`

| Variable | Description |
|----------|-------------|
| `TELEGRAM_API_ID` | Telegram API application ID |
| `TELEGRAM_API_HASH` | Telegram API hash |
| `TELEGRAM_SESSION_PATH` | Telethon session file path |
| `TELEGRAM_NUM_WORKERS` | Worker thread count |
| `TELEGRAM_SCORE_ALPHA` | EMA smoothing factor |
| `TELEGRAM_STALENESS_WEIGHT` | Staleness multiplier |
| `TELEGRAM_MIN_COOLDOWN_SECONDS` | Per-channel minimum interval |
| `TELEGRAM_MAX_POSTS_PER_CHANNEL` | Posts per crawl limit |
| `TELEGRAM_CHANNEL_RELOAD_SECONDS` | Channel list refresh interval |
| `BACKEND_BASE_URL` | Spring Boot URL |
| `BACKEND_EMAIL/PASSWORD` | Service account credentials |

---

## 11. Spring Boot Channel Scoring Integration

**File:** `backend/src/main/java/.../service/ChannelScoringService.java`

Backend computes `crawlPriority` returned in channel API responses:

```java
score = crawlScore
      + min(5.0, postFrequency × 2.0)           // posting frequency boost
      + min(3.0, log1p(avgViewCount) / 5.0)       // engagement boost
      + sqrt(hours_since_crawl) × 0.5             // staleness
      + (never_crawled ? 50.0 : 0)
      + (onboarding_completed ? 2.0 : 0)
```

Python scheduler reads this as `channel.crawlPriority` in priority calculation.

---

## 12. Inputs and Outputs

### Inputs
- Active Telegram channels from Spring Boot
- Telegram messages via MTProto or web scraper
- Channel metadata (username, lastCrawledAt, crawlScore)

### Outputs
- Telegram posts via `POST /api/telegram/posts/bulk`
- Crawl statistics via `PATCH /api/telegram/channels/{id}/crawl-stats`
- Operational logs via `/logs` API
