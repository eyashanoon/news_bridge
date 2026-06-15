# News Bridge — System Integration

## 1. Introduction

This document describes the complete integration architecture of the News Bridge platform: how all services communicate, how data flows from source to display, how scheduling coordinates background work, and the design philosophy behind the microservice split.

---

## 2. Full Data Flow

### 2.1 Web News Pipeline (End-to-End)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ PHASE 1: SOURCE REGISTRATION                                              │
├──────────────────────────────────────────────────────────────────────────┤
│ Admin UI (frontend/:5173)                                                │
│   POST /roots {name, baseUrl}                                            │
│   POST /roots/{id}/discover                                              │
│     → Spring Boot RootDiscoveryService                                   │
│     → POST endpoint-discovery:8004/discover/start                        │
│     → BFS crawl + page_classifier                                        │
│     → Poll GET /discover/jobs/{jobId}                                    │
│   POST /roots/{id}/endpoints/bulk                                        │
│     → Endpoints stored in MySQL                                          │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ PHASE 2: CONTINUOUS CRAWLING                                              │
├──────────────────────────────────────────────────────────────────────────┤
│ Site Crawler (crawler_server/:8000)                                      │
│   Worker threads pick endpoints by priority score                        │
│   For each listing endpoint:                                             │
│     web_fetch.fetch_soup(listing_url) → HTML                             │
│     Extract <a href> links                                               │
│     GET /cache-endpoints/urls-by-source → cached URL set                 │
│     For each NEW link:                                                   │
│       page_classifier.is_article(url, html) → boolean                    │
│       POST /cache-endpoints (always, regardless of outcome)              │
│       If article:                                                        │
│         extract_article(url, html) → {title, blocks}                     │
│         POST /articles → MySQL (Article + Post created)                  │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ PHASE 3: ENRICHMENT                                                       │
├──────────────────────────────────────────────────────────────────────────┤
│ post_processor (embedded in crawler, every 10s)                          │
│   SELECT posts WHERE tags_extracted = 0                                  │
│   classifier → posts.label (category)                                    │
│   NER + YAKE → post_tags table                                           │
│   langdetect → posts.lang                                                │
│   UPDATE posts SET tags_extracted = 1                                    │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ PHASE 4: AI INGESTION                                                     │
├──────────────────────────────────────────────────────────────────────────┤
│ AI Assistant (ai-assistant-service/:9000)                                │
│   IngestionScheduler (every 15 min):                                     │
│     GET recent posts from backend                                        │
│     Chunk text → Ollama embed → FAISS store                              │
│   On-demand during /query:                                               │
│     Tag extract → fetch by tags → ingest → vector search                 │
└──────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ PHASE 5: FRONTEND DISPLAY                                                 │
├──────────────────────────────────────────────────────────────────────────┤
│ News Feed (news-feed/:5174)                                              │
│   GET /api/feed → personalized post list                                 │
│   POST /ai/news-brief → AI summary                                       │
│   POST /ai/query → RAG Q&A                                               │
│   Render Post components with tags, category, reactions                    │
└──────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Telegram Pipeline (Parallel Track)

```
Admin registers channel → POST /api/telegram/channels
         │
         ▼
Channel onboarding → tag extraction → preference profile
         │
         ▼
Telegram Crawler (:8200) loads active channels
         │
         ▼
Worker threads pick channels by priority (ChannelScoringService)
         │
         ▼
Telethon MTProto fetch (fallback: web scraper)
         │
         ▼
POST /api/telegram/posts/bulk → MySQL
         │
         ▼
Posts appear in GET /api/telegram/feed and main feed
```

---

## 3. Service Communication

### 3.1 Communication Matrix

```
                    ┌─────────┐
                    │  :8080  │
                    │  Java   │
                    │ Backend │
                    └────┬────┘
         ┌───────────┬───┴───┬───────────┬──────────┐
         │           │       │           │          │
         ▼           ▼       ▼           ▼          ▼
      :8000       :8001   :8004       :8200     :9000
     Crawler       Tag    Discovery  Telegram   AI Asst
         │                               │          │
         └──────── writes articles ──────┘          │
         └──────── writes tg posts ─────────────────┘
                                                    │
                              Frontends ────────────┘
                              (:5173, :5174, mobile)
```

### 3.2 Java → Python (RestTemplate)

| Java Service | Python Target | Protocol |
|-------------|---------------|----------|
| `CrawlerAdminService` | `:8000` | HTTP REST (control API) |
| `RootDiscoveryService` | `:8004` | HTTP REST (discovery jobs) |
| `TelegramCrawlerAdminService` | `:8200` | HTTP REST (control API) |
| `ChannelTaggingService` | `:8001` | HTTP REST (`/extract-tags`) |

All proxied through Spring Boot admin controllers; Python services not directly exposed to frontends (except AI Assistant).

### 3.3 Python → Java (HTTP + JWT)

| Python Service | Auth Account | Write Endpoints |
|---------------|--------------|-----------------|
| Site Crawler | crawler-service@news.local | `/articles`, `/cache-endpoints`, `/endpoints/{id}/crawl-stats` |
| Telegram Crawler | telegram-crawler@news.local | `/api/telegram/posts/bulk`, `/api/telegram/channels/{id}/crawl-stats` |
| AI Assistant | Bearer token | Read-only: `/api/posts/*`, `/api/users/*/preferences` |
| post_processor | Direct MySQL | Bypasses Java API (direct DB writes) |

### 3.4 Frontend → Backend

| Frontend | Target | Auth |
|----------|--------|------|
| Admin (:5173) | `:8080` direct | JWT cookie `fp_token` |
| News Feed (:5174) | `:8080` via proxy | JWT localStorage + `nf_token` cookie |
| News Feed AI | `:9000` via `/ai` proxy | No auth (local dev) |
| Mobile | `:8080` direct (configurable host) | JWT AsyncStorage |
| Mobile AI | `:9000` direct | No auth |

### 3.5 Python → Python (Library Imports)

| Consumer | Library | Method |
|----------|---------|--------|
| Site Crawler | web_fetch | `import` (in-process) |
| Site Crawler | extractor | `import` (in-process) |
| Site Crawler | page_classifier | `import` via adapter |
| Site Crawler | post_processor | `import` (in-process) |
| Endpoint Discovery | web_fetch | `import` (in-process) |

No HTTP between Python libraries — shared code imported directly.

---

## 4. Data Contracts

### 4.1 Article Creation (Crawler → Backend)

```json
POST /articles
Authorization: Bearer <crawler-jwt>

{
  "url": "https://example.com/news/article-123",
  "endpointId": 42,
  "title": "Article Headline",
  "blocks": [
    {"type": "TEXT", "content": "Paragraph text...", "orderIndex": 0},
    {"type": "IMAGE", "url": "https://...", "altText": "...", "orderIndex": 1}
  ]
}
```

Response: `{ "id": 1234, "url": "...", ... }`

Side effect: `PostService` creates linked `Post` with `tagsExtracted=false`.

### 4.2 Telegram Bulk Posts

```json
POST /api/telegram/posts/bulk
Authorization: Bearer <telegram-crawler-jwt>

[
  {
    "channelId": 5,
    "messageId": 98765,
    "content": "Breaking news text...",
    "mediaUrl": "https://...",
    "viewCount": 1500,
    "postedAt": "2026-06-10T12:00:00Z"
  }
]
```

Response: `{ "created": 3, "skipped": 1, "errors": 0 }`

### 4.3 Feed Response

```json
GET /api/feed?category=Politics&page=0&size=20

[
  {
    "id": 1234,
    "title": "Headline",
    "summary": "First paragraph...",
    "category": "Politics",
    "tags": ["Biden", "election"],
    "likes": 15,
    "dislikes": 2,
    "createdAt": "2026-06-10T11:30:00Z",
    "articleUrl": "https://..."
  }
]
```

### 4.4 AI Query

```json
POST /ai/query (proxied to :9000)

{ "query": "What's happening in Gaza?", "postId": null }

Response:
{ "answer": "Based on recent news reports...", "sources": [...] }
```

### 4.5 Discovery Job

```json
POST :8004/discover/start
{ "root_url": "https://www.bbc.com", "max_depth": 2 }

Response: { "job_id": "abc-123" }

GET :8004/discover/jobs/abc-123
Response: {
  "status": "completed",
  "result": {
    "endpoints": [{"url": "...", "confidence": 0.89}],
    "cache": [...]
  }
}
```

---

## 5. Scheduling Architecture

### 5.1 Scheduling Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCHEDULING LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│ CONTINUOUS WORKER POOLS (always running)                        │
│ ├── Site Crawler: N threads × priority queue (:8000)          │
│ └── Telegram Crawler: N threads × priority queue (:8200)      │
├─────────────────────────────────────────────────────────────────┤
│ INTERVAL SCHEDULERS (APScheduler / AsyncIOScheduler)           │
│ ├── post_processor: every 10s (in crawler process)             │
│ ├── AI ingest: every 15 min (ai-assistant-service)             │
│ ├── Topic stats: every 60s (Spring Boot @Scheduled)            │
│ └── Legacy AI ingest: every 10 min (ai-service, tag-driven)    │
├─────────────────────────────────────────────────────────────────┤
│ BACKGROUND THREADS                                               │
│ └── Telegram channel reload: every 120s                          │
├─────────────────────────────────────────────────────────────────┤
│ ON-DEMAND (HTTP-triggered)                                       │
│ ├── Endpoint discovery jobs                                    │
│ ├── Manual crawl: POST /control/run-endpoint                     │
│ ├── Manual crawl: POST /control/run-endpoint (telegram)          │
│ └── AI query-triggered ingestion                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Priority Queue Systems

Both crawlers use identical priority philosophy:

**Site Crawler:**
```
priority = EMA(articles_found) + sqrt(hours_since_crawl) × staleness_weight
never_crawled → 9999 + score
```

**Telegram Crawler:**
```
priority = backend_crawlPriority + local_EMA + sqrt(hours_since_crawl) × staleness
never_crawled → 9999 + backend_priority
+ min_cooldown enforcement
+ waitlist rotation for low-priority channels
```

No fixed cron intervals for crawling — productivity-based scheduling ensures high-yield sources polled more frequently.

### 5.3 Service Manager Orchestration

**File:** `service-manager/electron/services.json`

Startup order for "Start Core Stack":
1. MySQL (Docker, :3307)
2. Spring Boot API (:8080)
3. Site Crawler (:8000)
4. Endpoint Discovery (:8004)
5. Telegram Crawler (:8200)
6. Admin Frontend (:5173)
7. AI Assistant (:9000) — optional
8. Ollama (:11434) — optional

Health checks verify port/HTTP reachability before marking services healthy.

---

## 6. AI Pipeline Integration

### 6.1 Embedding Flow

```
Post created in MySQL (tagsExtracted=false)
         │
         ▼ (within 10s)
post_processor classifies + tags
         │
         ▼ (within 15 min)
AI Assistant IngestionScheduler
         │
         ├── GET recent posts from backend
         ├── Skip already-ingested IDs
         ├── For each new post:
         │     Fetch content (title + body)
         │     Chunk (1000 chars, 200 overlap)
         │     Ollama nomic-embed-text → 768-dim vector
         │     L2 normalize
         │     FAISS IndexFlatIP.add()
         │     Persist faiss.index + meta.json
         │
         ▼
Vector store ready for semantic search
```

### 6.2 FAISS Storage Architecture

| Store | Path | Index Type | Consumers |
|-------|------|------------|-----------|
| AI Assistant | `ai-assistant-service/data/faiss.index` | IndexFlatIP, 768-dim | /query, /news-brief |
| Legacy AI | `ai-service/faiss.index` | IndexFlatIP, dynamic dim | /query (legacy) |

Both use inner product on L2-normalized vectors (= cosine similarity).

### 6.3 LLM Query Handling

```
User question
    │
    ├── Post-specific (postId provided)?
    │     → Fetch full content from backend
    │     → Direct LLM prompt (no RAG)
    │
    └── Topic search?
          → LLM extracts tags from question
          → Backend fetch posts by tags
          → Ingest into FAISS
          → Embed question → vector search
          → Top-k chunks as context
          → LLM generates answer
          → Append source references
```

### 6.4 RAG Architecture Diagram

```
                    ┌─────────────┐
                    │  User Query │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │     Intent Router       │
              │  (summary/QA/topic)     │
              └────────────┬────────────┘
                           │
            ┌──────────────┼──────────────┐
            ▼                             ▼
   ┌─────────────────┐          ┌─────────────────┐
   │ Post-Specific   │          │ Topic Search    │
   │ Direct Backend  │          │ Tag Extract     │
   │ Fetch + LLM     │          │ Backend Fetch   │
   └────────┬────────┘          │ Ingest → FAISS  │
            │                   │ Vector Search   │
            │                   │ LLM Generate    │
            │                   └────────┬────────┘
            │                            │
            └────────────┬───────────────┘
                         ▼
                  ┌─────────────┐
                  │   Answer    │
                  └─────────────┘
```

---

## 7. System Design Philosophy

### 7.1 Microservice Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Java for API/CRUD | Strong typing, mature security, JPA for complex relational model |
| Python for ML/crawling | Rich ML ecosystem (PyTorch, HuggingFace), async I/O for crawlers |
| Separate crawler services | Independent scaling, failure isolation, different scheduling needs |
| Shared libraries (web_fetch, extractor) | Code reuse without HTTP overhead |
| Ollama for LLM/embeddings | Local deployment, no external API costs, unified model runtime |
| FAISS for vectors | Fast exact search, simple persistence, no external vector DB |

### 7.2 Scalability Considerations

| Component | Scaling Strategy |
|-----------|-----------------|
| Site Crawler | Increase `CRAWLER_NUM_CHANNELS` worker threads |
| Telegram Crawler | Increase `TELEGRAM_NUM_WORKERS` |
| Spring Boot | Horizontal scaling with shared MySQL (stateless JWT) |
| FAISS | Rebuild index periodically; consider IVF for >100K vectors |
| Ollama | GPU acceleration; model quantization |
| MySQL | Read replicas for feed queries; connection pooling |

### 7.3 Separation of Concerns

```
┌─────────────────────────────────────────────────────────┐
│ CONCERN              │ OWNER                           │
├──────────────────────┼─────────────────────────────────┤
│ Data persistence     │ Spring Boot + MySQL             │
│ Authentication       │ Spring Boot JWT                 │
│ HTML fetching        │ web_fetch library               │
│ Content extraction   │ extractor library               │
│ Page classification  │ endpoint_discovery/page_classifier │
│ News classification  │ classifier_service / post_processor │
│ Tag extraction       │ tag_service / post_processor    │
│ Crawl scheduling     │ crawler_server / telegram_crawler │
│ Vector search        │ ai-assistant-service            │
│ LLM generation       │ Ollama                          │
│ User interface       │ frontend / news-feed / mobile   │
│ Operations           │ service-manager                 │
└──────────────────────┴─────────────────────────────────┘
```

### 7.4 Why Python + Java Split Exists

1. **Historical evolution** — Backend started as Java CRUD; ML capabilities added in Python
2. **Ecosystem fit** — Python dominates NLP/ML tooling; Java dominates enterprise API patterns
3. **Process isolation** — ML model loading (GB of RAM) isolated from API server
4. **Independent deployment** — Crawlers can restart without affecting API availability
5. **Team specialization** — Different skill sets for backend API vs ML engineering

### 7.5 Failure Isolation

| Failure | Impact | Mitigation |
|---------|--------|------------|
| Site Crawler down | No new web articles | Existing content still served; admin alerted |
| Telegram Crawler down | No new Telegram posts | Same as above |
| AI Assistant down | No Q&A/brief | Feed still works; graceful UI fallback |
| Ollama down | No LLM/embeddings | News brief falls back to headline list |
| MySQL down | Total outage | Docker health checks; service manager dependency order |
| Tag service down | Channel onboarding degraded | Keyword fallback in ChannelTaggingService |

---

## 8. Complete System Architecture Diagram

```
                         ┌─────────────────────────────────┐
                         │         CLIENT TIER               │
                         │  Admin(:5173) Feed(:5174) Mobile  │
                         └───────────────┬─────────────────┘
                                         │ HTTPS/JWT
                         ┌───────────────▼─────────────────┐
                         │      API TIER (Java :8080)      │
                         │  Auth │ CRUD │ Feed │ Admin     │
                         │  MySQL (news_crawler :3307)     │
                         └───┬───────┬───────┬──────┬─────┘
                             │       │       │      │
              ┌──────────────┘       │       │      └──────────────┐
              ▼                      ▼       ▼                     ▼
     ┌────────────────┐   ┌──────────────┐  ┌────────────┐  ┌──────────┐
     │ CRAWL TIER     │   │ DISCOVERY    │  │ NLP TIER   │  │ AI TIER  │
     │ Site (:8000)   │   │ (:8004)      │  │ Tag (:8001)│  │ Asst     │
     │ Telegram(:8200)│   │              │  │ Class(:8002)│  │ (:9000)  │
     └───────┬────────┘   └──────────────┘  └────────────┘  └────┬─────┘
             │                                                    │
     ┌───────▼────────┐                                    ┌──────▼─────┐
     │ LIBRARY TIER   │                                    │ Ollama     │
     │ web_fetch      │                                    │ (:11434)   │
     │ extractor      │                                    │ LLM+Embed  │
     │ post_processor │                                    └────────────┘
     └────────────────┘
```

---

## 9. Related Documentation Index

| Document | Focus |
|----------|-------|
| `system_overview.md` | High-level architecture |
| `backend_overview.md` | Spring Boot deep dive |
| `frontend_overview.md` | Client applications |
| `site_crawler.md` | Web crawling |
| `endpoint_discovery.md` | Listing discovery |
| `web_extractor.md` | Content extraction |
| `telegram_crawler.md` | Telegram ingestion |
| `recommendation_worker.md` | Personalization |
| `tag_service.md` | NLP tagging |
| `classifier_service.md` | Category classification |
| `embedding_service.md` | Vector embeddings |
| `ai_assistant_service.md` | RAG pipeline |
| `ai_vector_search.md` | Legacy vector search |
| `avatar_system.md` | 3D presenter |
