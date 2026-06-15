# News Bridge — Complete Project Documentation

> **Generated:** June 14, 2026  
> **Repository:** `news_bridge`  
> **Purpose:** Distributed news aggregation, enrichment, personalization, and AI-assisted consumption platform

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Repository Layout](#4-repository-layout)
5. [Prerequisites](#5-prerequisites)
6. [Installation & First Run](#6-installation--first-run)
7. [Service Registry & Ports](#7-service-registry--ports)
8. [Configuration Reference](#8-configuration-reference)
9. [Web News Pipeline](#9-web-news-pipeline)
10. [Telegram Pipeline](#10-telegram-pipeline)
11. [Enrichment & NLP](#11-enrichment--nlp)
12. [AI Assistant & RAG](#12-ai-assistant--rag)
13. [Feed Personalization](#13-feed-personalization)
14. [Spring Boot Backend](#14-spring-boot-backend)
15. [Client Applications](#15-client-applications)
16. [Authentication & Security](#16-authentication--security)
17. [Database Schema](#17-database-schema)
18. [API Reference Summary](#18-api-reference-summary)
19. [Service Manager](#19-service-manager)
20. [Avatar System](#20-avatar-system)
21. [Design Principles](#21-design-principles)
22. [Troubleshooting](#22-troubleshooting)
23. [Further Documentation](#23-further-documentation)

---

## 1. Executive Summary

**News Bridge** is a full-stack news platform that:

- **Ingests** content from web news sites (HTML crawling) and Telegram channels (MTProto + web scraper)
- **Extracts** structured articles from raw HTML using deep-learning models
- **Enriches** posts with category labels, named entities, and keywords (English + Arabic)
- **Stores** everything in a central MySQL database via a Spring Boot API
- **Personalizes** feeds using user preference vectors, engagement signals, and geographic proximity
- **Powers** AI features (news briefs, RAG Q&A) via Ollama embeddings and FAISS vector search
- **Serves** content through admin console, consumer web app, and Expo mobile app

The platform deliberately splits responsibilities:

| Layer | Technology | Role |
|-------|-----------|------|
| **API / persistence** | Java 17, Spring Boot 3.5, MySQL | System of record, auth, REST gateway |
| **Crawling / ML** | Python 3, FastAPI, PyTorch, HuggingFace | I/O-heavy crawlers, NLP, classification |
| **AI runtime** | Ollama + FAISS | Local LLM + vector search |
| **Clients** | React 19, Vite, Expo | Admin + consumer UIs |

---

## 2. System Architecture

### 2.1 High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT APPLICATIONS                                  │
│  frontend/ (Admin :5173)  │  news-feed/ (Web :5174)  │  news-feed/mobile/   │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │ HTTPS / REST / JWT
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Spring Boot Backend (:8080)                               │
│  Controllers → Services → Repositories → MySQL (news_crawler :3307)         │
└───────┬──────────────┬──────────────┬──────────────┬──────────────────────┘
        │              │              │              │
        ▼              ▼              ▼              ▼
   :8000 Site     :8004 Endpoint  :8200 Telegram  :8001 Tag
   Crawler        Discovery       Crawler          Service
        │              │              │
        │         :8002 Classifier   │
        │              │              │
        └──────────────┴──────────────┘
                       │
        ┌──────────────┴──────────────┐
        ▼                             ▼
   :9000 AI Assistant            :9001 AI Service (legacy)
   (RAG + News Brief)            (tag-driven FAISS)
        │                             │
        └──────────────┬──────────────┘
                       ▼
                 Ollama (:11434)
                 nomic-embed-text + LLM
```

### 2.2 Communication Matrix

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

### 2.3 Integration Patterns

| Direction | Mechanism | Examples |
|-----------|-----------|----------|
| Java → Python | `RestTemplate` HTTP | Crawler control, discovery jobs, tag extraction |
| Python → Java | HTTP + JWT Bearer | Article/post bulk writes, crawl stats |
| Python → MySQL | Direct SQLAlchemy | `post_processor` (bypasses Java API) |
| Frontend → Java | axios / fetch | All CRUD, feeds, auth |
| Frontend → AI | Vite proxy `/ai` → :9000 | News brief, chat widget |
| Python libraries | In-process import | `web_fetch`, `extractor`, `page_classifier` |

---

## 3. Technology Stack

### 3.1 Backend API

| Component | Version / Tool |
|-----------|----------------|
| Runtime | Java 17 |
| Framework | Spring Boot 3.5.0 |
| ORM | Spring Data JPA (Hibernate) |
| Database | MySQL 8.4 (Docker, port 3307) |
| Security | Spring Security + JWT (jjwt 0.12.3) |
| API docs | springdoc-openapi 2.6.0 |
| Build | Maven |

### 3.2 Python Microservices

| Component | Tools |
|-----------|-------|
| Web framework | FastAPI + uvicorn |
| Crawling | requests, BeautifulSoup, curl_cffi, Playwright |
| Telegram | Telethon (MTProto) |
| ML/NLP | PyTorch, HuggingFace Transformers, XLM-RoBERTa, BERT-NER, YAKE |
| Scheduling | APScheduler, threading |
| Vector search | FAISS (IndexFlatIP) |

### 3.3 AI Runtime

| Component | Details |
|-----------|---------|
| Ollama | Port 11434 — local LLM + embeddings |
| Embedding model | `nomic-embed-text` (768 dimensions) |
| LLM | Configurable (e.g. llama3) |

### 3.4 Frontends

| App | Stack |
|-----|-------|
| Admin (`frontend/`) | React 19, Vite 8, React Router 7, axios |
| News Feed (`news-feed/`) | React 19, Vite 7, Tailwind CSS 4, i18next, framer-motion, Three.js |
| Mobile (`news-feed/mobile/`) | Expo 56, React Native 0.85, React Navigation 7 |

### 3.5 Operations

| Tool | Purpose |
|------|---------|
| Docker Compose | MySQL container |
| Service Manager (`service-manager/`) | Electron desktop app for orchestrating all services |
| Avatar server (`avatar/`) | TTS + Rhubarb lip-sync (port 3001) |

---

## 4. Repository Layout

```
news_bridge/
├── backend/                         # Java Spring Boot + Python microservices
│   ├── src/main/java/               # Spring Boot application (com.example.newscrawler)
│   ├── src/main/resources/          # application.yml, static assets
│   ├── init.sql                     # MySQL bootstrap script
│   ├── docker-compose.yml           # MySQL container definition
│   ├── pom.xml                      # Maven build
│   ├── crawler_server/              # Site crawler (:8000)
│   ├── endpoint_discovery/          # BFS listing discovery (:8004)
│   ├── telegram_crawler/            # Telegram crawler (:8200)
│   ├── tag_service/                 # Tag extraction API (:8001)
│   ├── classifier_service/          # Category classifier (:8002)
│   ├── ai-assistant-service/        # Primary RAG service (:9000)
│   ├── ai-service/                  # Legacy vector search (:9001)
│   ├── web_fetch/                   # Shared anti-bot HTML fetch library
│   ├── extractor/                   # DL-based article content extraction
│   ├── post_processor.py            # Embedded enrichment (runs inside site crawler)
│   └── checker/                     # URL classification utilities
├── frontend/                        # Admin React app (:5173)
├── news-feed/                       # Consumer web app (:5174)
│   ├── mobile/                      # Expo/React Native app
│   └── docs/                        # Feed algorithm documentation
├── avatar/                          # Avatar TTS/lip-sync server (:3001)
├── avatar-studio-component/         # Embeddable 3D avatar iframe package
├── service-manager/                 # Desktop orchestration tool (Electron)
└── docs/                            # Architecture & service documentation
```

### Shared Python Libraries (not standalone services)

| Library | Path | Role |
|---------|------|------|
| `web_fetch` | `backend/web_fetch/` | Anti-bot HTML fetching (curl_cffi + Playwright fallback) |
| `extractor` | `backend/extractor/` | DL-based article content extraction |
| `post_processor` | `backend/post_processor.py` | Batch classifier + tagger (embedded in site crawler) |
| `page_classifier` | `backend/endpoint_discovery/page_classifier/` | XLM-RoBERTa page type classification |

---

## 5. Prerequisites

### Required

| Tool | Version | Notes |
|------|---------|-------|
| **Java JDK** | 17+ | For Spring Boot backend |
| **Maven** | 3.8+ | Backend build |
| **Node.js** | 18+ | Frontends and service manager |
| **npm** | 9+ | Package management |
| **Python** | 3.10+ | Microservices |
| **Docker** | Latest | MySQL container |
| **Git** | Latest | Source control |

### Optional (for full feature set)

| Tool | Purpose |
|------|---------|
| **Ollama** | LLM + embeddings for AI features |
| **Telegram API credentials** | MTProto access (`my.telegram.org`) |
| **NVIDIA GPU** | Faster ML inference (CPU works with reduced performance) |
| **Playwright browsers** | `playwright install` for JS-heavy site fetching |

### System Resources (recommended)

- **RAM:** 16 GB+ (ML models load several GB)
- **Disk:** 10 GB+ (models, FAISS indices, MySQL data)
- **CPU:** Multi-core (crawler worker threads benefit from parallelism)

---

## 6. Installation & First Run

### 6.1 Clone & Database

```bash
git clone <repository-url> news_bridge
cd news_bridge/backend

# Start MySQL
docker compose up -d mysql

# Wait until healthy
docker compose ps
```

**Default MySQL credentials:**

| Setting | Value |
|---------|-------|
| Host | `localhost` |
| Port | `3307` (mapped from container 3306) |
| Database | `news_crawler` |
| User | `news_user` |
| Password | `news_pass` |
| Root password | `0000` |

### 6.2 Spring Boot Backend

```bash
cd backend
mvn spring-boot:run
```

Backend starts on **http://localhost:8080**.

**Bootstrap accounts** (created on first startup by `DataInitializer.java`):

| Account | Email | Default Password | Purpose |
|---------|-------|------------------|---------|
| Owner | `owner@news.local` | `change-me` | Full admin access |
| Site Crawler | `crawler-service@news.local` | `secure-crawler-password-change-me` | Writes articles |
| Telegram Crawler | `telegram-crawler@news.local` | `secure-telegram-password-change-me` | Writes Telegram posts |

### 6.3 Python Microservices

Install dependencies per service:

```bash
# Site crawler (includes ML models — large download)
cd backend/crawler_server
pip install -r requirements.txt
playwright install chromium   # optional, for JS-heavy sites

# Telegram crawler
cd backend/telegram_crawler
pip install -r requirements.txt
cp .env.example .env          # configure credentials

# Tag service
cd backend/tag_service
pip install -r requirements.txt

# Classifier service
cd backend/classifier_service
pip install -r requirements.txt

# Endpoint discovery
cd backend/endpoint_discovery
pip install -r requirements.txt

# AI Assistant
cd backend/ai-assistant-service
pip install -r requirements.txt
```

### 6.4 Frontends

```bash
# Admin panel
cd frontend
npm install
npm run dev          # → http://localhost:5173

# News feed
cd news-feed
npm install
npm run dev -- --port 5174   # → http://localhost:5174
```

### 6.5 Ollama (AI features)

```bash
# Install Ollama from https://ollama.ai
ollama serve
ollama pull nomic-embed-text
ollama pull llama3          # or your preferred LLM
```

### 6.6 Telegram Session Setup

```bash
cd backend/telegram_crawler
# Set TELEGRAM_API_ID and TELEGRAM_API_HASH in .env
python setup_session.py     # interactive Telethon login
```

### 6.7 Quick Start via Service Manager

The **Service Manager** desktop app (`service-manager/`) can start the entire stack in dependency order:

1. MySQL → Spring Boot → Site Crawler → Telegram Crawler → Admin → News Feed → AI Assistant → Ollama

```bash
cd service-manager
npm install
npm start
```

---

## 7. Service Registry & Ports

| Service | Port | Entry Point | Health Check |
|---------|------|-------------|--------------|
| MySQL | 3307 | `docker compose up mysql` | TCP :3307 |
| Spring Boot API | 8080 | `mvn spring-boot:run` | HTTP :8080 |
| Site Crawler | 8000 | `backend/crawler_server/main.py` | GET /health |
| Tag Service | 8001 | `backend/tag_service/app.py` | GET / |
| Classifier Service | 8002 | `backend/classifier_service/news_classifier_app.py` | GET /health |
| Endpoint Discovery | 8004 | `backend/endpoint_discovery/service.py` | GET /health |
| Telegram Crawler | 8200 | `backend/telegram_crawler/main.py` | GET /health |
| AI Assistant | 9000 | `backend/ai-assistant-service/main.py` | TCP :9000 |
| AI Service (legacy) | 9001 | `backend/ai-service/main.py` | TCP :9001 |
| Admin Frontend | 5173 | `frontend/` | TCP :5173 |
| News Feed | 5174 | `news-feed/` | TCP :5174 |
| Avatar Speech | 3001 | `avatar/server.js` | TCP :3001 |
| Ollama | 11434 | `ollama serve` | TCP :11434 |
| Expo Metro | 8081 | `news-feed/mobile/` | TCP :8081 |

---

## 8. Configuration Reference

### 8.1 Spring Boot (`backend/src/main/resources/application.yml`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_URL` | `jdbc:mysql://localhost:3307/news_crawler?...` | JDBC connection string |
| `DB_USERNAME` | `news_user` | Database user |
| `DB_PASSWORD` | `news_pass` | Database password |
| `JPA_DDL_AUTO` | `update` | Hibernate schema mode |
| `JWT_SECRET` | (dev default) | **Change in production** |
| `JWT_EXPIRATION` | `86400000` (24h) | Token lifetime in ms |
| `CRAWLER_SERVER_BASE_URL` | `http://127.0.0.1:8000` | Site crawler proxy target |
| `TELEGRAM_CRAWLER_BASE_URL` | `http://localhost:8200` | Telegram crawler proxy target |
| `TAG_SERVICE_BASE_URL` | `http://localhost:8001` | Tag extraction service |
| `ENDPOINT_DISCOVERY_BASE_URL` | `http://localhost:8004` | Discovery service |
| `CRAWLER_EMAIL` / `CRAWLER_PASSWORD` | crawler-service@news.local | Site crawler service account |
| `UPLOAD_DIR` | `uploads` | File upload directory |

### 8.2 Site Crawler (`backend/crawler_server/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_BASE_URL` | `http://localhost:8080` | Spring Boot URL |
| `BACKEND_EMAIL` | `crawler-service@news.local` | Service account |
| `BACKEND_PASSWORD` | (see application.yml) | Service account password |
| `CRAWLER_INTERVAL_MINUTES` | `5` | Legacy interval setting |
| `CRAWLER_MAX_LINKS_PER_LISTING` | `500` | Max links per listing page |
| `CRAWLER_NUM_CHANNELS` | `3` | Worker thread count |
| `CRAWLER_REQUEST_TIMEOUT_SECONDS` | `30` | HTTP timeout |
| `CRAWLER_RESTRICT_SAME_DOMAIN` | `true` | Same-domain link filtering |
| `SKIP_MODEL_LOAD` | `0` | Set to `1` to skip heavy ML model loading |

### 8.3 Telegram Crawler (`backend/telegram_crawler/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `BACKEND_BASE_URL` | `http://localhost:8080` | Spring Boot URL |
| `BACKEND_EMAIL` | `telegram-crawler@news.local` | Service account |
| `BACKEND_PASSWORD` | (see application.yml) | Service account password |
| `TELEGRAM_API_ID` | `0` | Telegram API application ID |
| `TELEGRAM_API_HASH` | | Telegram API hash |
| `TELEGRAM_SESSION_PATH` | `telegram_session` | Telethon session file |
| `TELEGRAM_NUM_WORKERS` | `3` | Worker thread count |
| `TELEGRAM_SCORE_ALPHA` | `0.3` | EMA smoothing for productivity |
| `TELEGRAM_STALENESS_WEIGHT` | `5.0` | Staleness multiplier |
| `TELEGRAM_MIN_COOLDOWN_SECONDS` | `600` | Per-channel minimum crawl interval |
| `TELEGRAM_MAX_POSTS_PER_CHANNEL` | `100` | Posts per crawl cycle |
| `TELEGRAM_CHANNEL_RELOAD_SECONDS` | `120` | Channel list refresh interval |

### 8.4 Post Processor (environment)

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | MySQL host |
| `DB_PORT` | `3307` | MySQL port |
| `DB_NAME` | `news_crawler` | Database name |
| `DB_USERNAME` | `news_user` | Database user |
| `DB_PASSWORD` | `news_pass` | Database password |
| `CLASSIFIER_MODEL_PATH` | `classifier_service/final_mode_V2` | Local classifier model |
| `SKIP_MODEL_LOAD` | `0` | Skip ML models for fast dev |

---

## 9. Web News Pipeline

The web news pipeline transforms registered news domains into structured, classified, tagged feed posts.

### 9.1 Phase 1 — Source Registration (Admin)

1. Admin registers a **Root** (news domain) via `POST /roots` in the admin UI.
2. **Endpoint discovery** (`endpoint_discovery/`, port 8004) performs BFS crawling within the domain.
3. An **XLM-RoBERTa page classifier** categorizes pages as listing vs. article vs. other.
4. Discovered listing URLs are bulk-imported as **Endpoints** via `POST /roots/{id}/endpoints/bulk`.
5. Root verification may consult Wayback Machine CDX and Wikidata SPARQL for trust assessment.

### 9.2 Phase 2 — Continuous Web Crawling

The **Site Crawler** (`crawler_server/`, port 8000) runs a pool of worker threads.

**Priority formula:**

```
priority = EMA(articles_found) + sqrt(hours_since_last_crawl) × staleness_weight
never_crawled → priority = 9999 + score
```

**Per-endpoint algorithm:**

1. Select highest-priority endpoint from queue
2. Fetch listing page HTML via `web_fetch.fetch_soup`
3. Extract all `<a href>` links
4. Bulk-load cached URLs from `GET /cache-endpoints/urls-by-source`
5. Process only **new** (uncached) URLs
6. For each candidate URL:
   - **Page classifier** determines if URL is an article
   - **Cache endpoint** regardless of outcome (`POST /cache-endpoints`)
   - If article: **extractor** parses HTML into structured blocks
   - Persist via `POST /articles` (creates Article + linked Post)

**Article payload example:**

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

### 9.3 Phase 3 — Enrichment

Every **10 seconds**, `post_processor` (embedded in the site crawler process):

1. `SELECT posts WHERE label IS NULL` → classify with transformer model
2. `SELECT posts WHERE tags_extracted = 0` → extract entities (BERT-NER EN/AR) + keywords (YAKE)
3. `langdetect` → set `posts.lang`
4. Write tags to `PostTags` table
5. Set `tags_extracted = 1`

### 9.4 Phase 4 — AI Ingestion

**AI Assistant** (`ai-assistant-service/`, port 9000) runs an ingestion scheduler every **15 minutes**:

1. Fetch recent posts from backend
2. Skip already-ingested IDs
3. Chunk text (1000 chars, 200 overlap)
4. Ollama `nomic-embed-text` → 768-dim vector
5. L2 normalize → FAISS `IndexFlatIP.add()`
6. Persist `faiss.index` + `meta.json`

### 9.5 Phase 5 — Consumption

- News Feed calls `GET /api/feed` with category/location filters
- News Brief panel calls `POST /ai/news-brief`
- ChatWidget calls `POST /ai/query` for RAG Q&A

---

## 10. Telegram Pipeline

The Telegram pipeline runs **in parallel** to the web news pipeline as a separate ingestion track.

### 10.1 End-to-End Flow

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
Telethon MTProto fetch (fallback: t.me/s web scraper)
         │
         ▼
POST /api/telegram/posts/bulk → MySQL
         │
         ▼
Posts served via GET /api/telegram/feed/*
```

### 10.2 Channel Registration & Onboarding

1. **Search & add** — Admin searches channels via crawler `/search` (Telethon or web scraper).
2. **Create channel** — `POST /api/telegram/channels` with normalized username.
3. **Onboarding questionnaire** — Adaptive decision tree (`ChannelOnboardingService`): purpose → scope → region/country.
4. **Profile building** — `ChannelProfileService` fuses:
   - Questionnaire intent vector
   - Admin description tags (via tag service)
   - Recent post content tags
5. **Activation** — Only `ACTIVE` channels appear in `GET /api/telegram/channels/active`.

### 10.3 Telegram Crawler Architecture

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

### 10.4 Channel Scheduling

**Priority formula:**

```
priority = backend_crawlPriority + local_EMA_score + staleness_bonus
staleness_bonus = sqrt(hours_since_last_crawl) × staleness_weight
never_crawled → priority = 9999 + backend_priority + local_score
```

**Backend crawl priority** (`ChannelScoringService`):

```java
score = crawlScore
      + min(5.0, postFrequency × 2.0)           // posting frequency
      + min(3.0, log1p(avgViewCount) / 5.0)       // engagement
      + sqrt(hours_since_crawl) × 0.5             // staleness
      + (never_crawled ? 50.0 : 0)
      + (onboarding_completed ? 2.0 : 0)
```

**Scheduling mechanisms:**

| Mechanism | Behavior |
|-----------|----------|
| Min cooldown | Channel excluded from queue until cooldown elapsed |
| Waitlist | Low-priority channels (score < 2.0, crawls > 3) rotate in every 5 picks |
| Anti-consecutive | Same channel not picked twice when alternatives exist |
| MTProto lock | One Telethon operation at a time across all workers |
| Channel reload | Background thread refreshes active channel list every 120s |

### 10.5 Message Fetching

**Primary: MTProto via Telethon**

- Dedicated asyncio event loop in a daemon thread (isolated from uvicorn)
- User session file at `TELEGRAM_SESSION_PATH`
- Returns: message ID, text, media type, view count, timestamp

**Fallback: Web Scraper**

- Scrapes public `t.me/s/{username}` preview pages
- Used when Telethon session unavailable, rate limited, or channel restricted

### 10.6 Backend Ingestion

`TelegramPostService.bulkCreate()`:

1. Deduplicate on `(channelId, telegramMessageId)`
2. Save `TelegramPost` entity
3. Mirror into shared `posts` table via `PostService.createFromTelegramPost()`
4. Update channel stats

**Bulk post payload:**

```json
POST /api/telegram/posts/bulk
Authorization: Bearer <telegram-crawler-jwt>

{
  "posts": [
    {
      "channelId": 5,
      "telegramMessageId": 98765,
      "content": "Breaking news text...",
      "mediaUrl": "https://...",
      "mediaType": "photo",
      "messageDate": "2026-06-10T12:00:00Z",
      "viewCount": 1500,
      "edited": false
    }
  ]
}
```

Response: `{ "created": 3, "skipped": 1, "errors": [] }`

### 10.7 Telegram Tagging

Telegram posts use a **separate tagging path** from the site crawler's `post_processor`:

- `TelegramPostTaggingService` → tag service (`POST :8001/extract-tags`)
- Tags stored in `telegram_post_tags` table
- Admin can trigger re-tagging via `TelegramAdminPostService.retag()`
- Channel-level tags refreshed on crawl via `ChannelProfileService.refreshPostTags()`

### 10.8 Telegram Feed API

| Tab | Endpoint | Ranking |
|-----|----------|---------|
| **For You** | `GET /api/telegram/feed/for-you` | Blends Telegram engagement vector + site tag preferences |
| **By Channel** | `GET /api/telegram/feed/by-channel` | Chronological per channel |
| **Discover** | `GET /api/telegram/feed/discover?q=` | Tag/text/profile search |

**For You scoring:**

```
total = 0.40 × channelAff + 0.25 × tagAff + 0.22 × recency + 0.10 × engagement + exploration
```

**Engagement learning:**

- View (55% visible) → `POST /api/telegram/interactions/view` (+0.15 preference delta)
- Read time → `POST /api/telegram/interactions/time` (stronger signal, capped at 3.0)

### 10.9 Crawler Control API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Scheduler + Telegram API readiness |
| POST | `/run-now` | Trigger immediate crawl cycle |
| GET | `/search?q=` | Channel search |
| GET | `/control/status` | Worker/queue state |
| POST | `/control/start` | Resume scheduler |
| POST | `/control/stop` | Pause scheduler |
| POST | `/control/restart` | Restart scheduler |
| POST | `/control/reload` | Reload channels from backend |
| POST | `/control/interval` | Set min cooldown (minutes) |
| GET/DELETE | `/logs` | Log buffer |

Proxied by Spring Boot `TelegramCrawlerAdminService` at `/api/admin/telegram-crawler/*`.

---

## 11. Enrichment & NLP

### 11.1 Tag Service (`:8001`)

- **Endpoint:** `POST /extract-tags` with `{"text": "..."}`
- **Models:** BERT-NER (English), CAMeL-BERT-NER (Arabic), YAKE keyword extraction
- **Consumers:** `ChannelTaggingService`, `TelegramPostTaggingService`

### 11.2 Classifier Service (`:8002`)

- Assigns category labels: Politics, Sports, Technology, Business, etc.
- Fine-tuned transformer model at `classifier_service/final_mode_V2/`
- Also embedded in `post_processor.py` for direct MySQL writes

### 11.3 Post Processor (embedded)

Runs inside the site crawler process every 10 seconds:

1. **Classify** — transformer model or keyword heuristic fallback
2. **Tag** — NER entities + YAKE keywords with scored confidence
3. **Language detect** — `langdetect` with Arabic normalization
4. **Persist** — direct MySQL writes to `posts` and `PostTags`

Set `SKIP_MODEL_LOAD=1` for development without loading multi-GB models.

### 11.4 Page Classifier

- XLM-RoBERTa model in `endpoint_discovery/page_classifier/`
- Classifies crawled pages as article, listing, or other
- Used during endpoint discovery and site crawling

### 11.5 Content Extractor

- Deep-learning model in `backend/extractor/content_model/`
- Parses article HTML into structured blocks (text, images, video, audio)
- Invoked by site crawler for confirmed article URLs

---

## 12. AI Assistant & RAG

### 12.1 Architecture

**Service:** `backend/ai-assistant-service/` (port 9000)

**Storage:** `ai-assistant-service/data/faiss.index` + `meta.json`

**Index type:** FAISS `IndexFlatIP` with L2-normalized 768-dim vectors (cosine similarity via inner product)

### 12.2 Ingestion Scheduler

- Runs every **15 minutes**
- Fetches recent posts from Spring Boot backend
- Skips already-ingested post IDs
- Chunks text (1000 chars, 200 char overlap)
- Embeds via Ollama `nomic-embed-text`
- Adds to FAISS index and persists to disk

### 12.3 Query Flow

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

### 12.4 Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /query` | RAG Q&A on news corpus |
| `POST /news-brief` | Personalized AI news summary |
| `GET /health` | Service health |

**News Feed proxy:** Vite dev server proxies `/ai/*` → `:9000`

### 12.5 Legacy AI Service (`:9001`)

- Tag-driven FAISS vector search
- Separate index at `ai-service/faiss.index`
- Superseded by AI Assistant for primary features

---

## 13. Feed Personalization

### 13.1 Main News Feed (`GET /api/feed`)

**Scoring formula:**

```
score = 0.45 × tagAffinity
      + 0.25 × categoryAffinity
      + 0.15 × recency
      + 0.10 × popularity
      + 0.05 × exploration
```

| Component | Weight | Description |
|-----------|--------|-------------|
| Tag Affinity | 0.45 | Match between post tags and user's `UserPreference` weights |
| Category Affinity | 0.25 | User's preference for the post's category label |
| Recency | 0.15 | Exponential time decay |
| Popularity | 0.10 | Like-to-dislike ratio |
| Exploration | 0.05 | Random factor for diversity |

**Additional signals:**

- Geographic proximity (when `lat`/`lon` provided)
- Seen-post exclusion (posts user already viewed are filtered out)
- Category filter ("General" = all categories)

### 13.2 Telegram Feed

See [Section 10.8](#108-telegram-feed-api) for Telegram-specific personalization.

**Key difference:** Telegram feed learns from **content-topic engagement** (view time, scroll visibility) rather than like/dislike, and blends with site article tag preferences when Telegram signal is weak.

### 13.3 User Preference Learning

- **Site feed:** `UserPreference` entries updated on interactions (views, likes, time spent)
- **Telegram feed:** `UserTelegramContentPreference.contentTagVector` updated from engagement events
- **Tag vectors:** Stored as JSON, normalized, compared via cosine similarity (`TagVectorUtils`)

---

## 14. Spring Boot Backend

### 14.1 Architectural Layers

```
HTTP Request
     │
     ▼
Controller Layer (~31 REST controllers)
  - Request validation (DTOs)
  - @PreAuthorize role checks
     │
     ▼
Service Layer (~43 services)
  - Business logic
  - RestTemplate calls to Python services
  - Transaction boundaries
     │
     ▼
Repository Layer (~43 JPA repositories)
     │
     ▼
MySQL (news_crawler)
```

### 14.2 Package Structure

| Package | Responsibility |
|---------|----------------|
| `config` | Security, OpenAPI, data bootstrap |
| `controller` | REST endpoints |
| `dto` | Request/response records (~95) |
| `entity` | JPA entities and enums (~56) |
| `repository` | Data access (~43) |
| `security` | JWT filter and token provider |
| `service` | Business logic (~43) |
| `util` | Helpers (e.g. `TagVectorUtils`) |

### 14.3 Key Services

| Service | Responsibility |
|---------|----------------|
| `ArticleService` | Article CRUD, block assembly |
| `PostService` | Feed post management, Telegram mirroring |
| `FeedService` | Personalized feed scoring |
| `TelegramFeedService` | Telegram feed tabs + engagement learning |
| `ChannelScoringService` | Telegram crawl priority computation |
| `ChannelProfileService` | Channel onboarding profiles |
| `ChannelTaggingService` | Tag extraction for channels/posts |
| `RootDiscoveryService` | Endpoint discovery job orchestration |
| `CrawlerAdminService` | Site crawler control proxy |
| `TelegramCrawlerAdminService` | Telegram crawler control proxy |
| `SearchService` | Full-text post search |
| `UserIntelligenceService` | User behavior aggregation |

### 14.4 Scheduled Tasks

| Task | Interval | Owner |
|------|----------|-------|
| Topic stats refresh | 60s | Spring Boot `@Scheduled` |
| Post processor | 10s | Site crawler (Python) |
| AI ingestion | 15 min | AI Assistant (Python) |
| Telegram channel reload | 120s | Telegram crawler (thread) |
| Legacy AI ingest | 10 min | AI Service (Python) |

---

## 15. Client Applications

### 15.1 Admin Frontend (`frontend/`, port 5173)

**Stack:** React 19, Vite 8, React Router 7, axios

**Auth:** JWT in cookie `fp_token` via `POST /auth/admin/login`

**Key routes:**

| Route | Feature |
|-------|---------|
| `/admin` | Dashboard with aggregate stats |
| `/admin/users` | User management |
| `/admin/articles` | Article management |
| `/admin/roots`, `/admin/endpoints` | Source registration & discovery |
| `/admin/crawler` | Site crawler control |
| `/admin/telegram` | Telegram channel & crawler management |
| `/admin/topics`, `/admin/fields` | Editorial taxonomy |
| `/editor/workspace` | Editor content workspace |

**API pattern:** Page → feature component → service module → `api.get/post(..., authConfig(token))`

### 15.2 News Feed Web (`news-feed/`, port 5174)

**Stack:** React 19, Vite 7, Tailwind CSS 4, i18next, framer-motion, Three.js

**Auth:** JWT in localStorage + `nf_token` cookie

**Dev proxy:** `/api`, `/auth` → `:8080`; `/ai` → `:9000`

**Hub routes (single-page `HomePage.jsx`):**

| Route | View |
|-------|------|
| `/news` | Main personalized feed |
| `/news/trending` | Trending topics |
| `/news/saved` | Saved posts (localStorage) |
| `/news/telegram` | Telegram feed (3 tabs) |
| `/news/topics/:topicId` | Topic detail |
| `/news/category/:categoryName` | Category filter |
| `/news/avatar` | 3D avatar presenter modal |

**Key components:**

| Component | Role |
|-----------|------|
| `Feed.jsx` | Main article feed with infinite scroll |
| `TelegramFeed.jsx` | Telegram For You / By Channel / Discover tabs |
| `TelegramPostCard.jsx` | Post card with engagement tracking |
| `ChatWidget.jsx` | RAG Q&A interface |
| `NewsBriefPanel.jsx` | AI news summary |
| `LeftSidebar.jsx` | Navigation, categories, topics |

**i18n:** English + Arabic with RTL layout support

### 15.3 Mobile App (`news-feed/mobile/`)

**Stack:** Expo 56, React Native 0.85, React Navigation 7

**Features:** Mirrors web feed experience with native navigation

**API:** Direct calls to configurable backend host (default `localhost:8080`)

**Key screens:** `TelegramFeedPage.jsx`, article feed, auth flow

---

## 16. Authentication & Security

### 16.1 JWT-Based Stateless Auth

- **Policy:** STATELESS (no server-side sessions)
- **Signing:** HS512 with `JWT_SECRET`
- **Expiration:** 24 hours default
- **Transport:** `Authorization: Bearer <token>` header

### 16.2 JWT Claims

| Claim | Content |
|-------|---------|
| `sub` | User ID |
| `type` | `PRIMITIVE`, `REGISTERED`, `EDITOR`, or `ADMIN` |
| `email` | User email |
| `roles` | List of `UserRole` enum names |

### 16.3 User Types

1. **PrimitiveUser** — Guest sessions via `POST /auth/limited`; synthetic JWT without DB row
2. **RegisteredUser** — Standard accounts
3. **EditorUser** — Editorial accounts with topic/event permissions
4. **Admin** — Separate `admins` table with fine-grained roles

### 16.4 Key Roles

| Role | Capability |
|------|-----------|
| `OWNER` | Full system access (all roles granted) |
| `MANAGE_USERS` | User administration |
| `MANAGE_TELEGRAM_CHANNELS` | Telegram channel management |
| `WRITE_TELEGRAM_POSTS` | Bulk Telegram post ingestion |
| `WRITE_SYSTEM_ARTICLE` | Crawler article writes |
| `CONTROL_CRAWLER` | Crawler start/stop/logs |
| `VIEW_TELEGRAM_POSTS` | Read Telegram content |

### 16.5 Public Endpoints (no auth required)

- All `/auth/**` routes
- Swagger UI (`/swagger-ui/**`)
- Selected GET: article content, feed, telegram feed, public events, comments (read)
- Upload endpoints (`/api/upload/**`)

### 16.6 MFA & Device Tracking

`AuthController` supports multi-factor verification with `LoginDevice` entity for trusted device tracking.

---

## 17. Database Schema

### 17.1 Core Content Graph

```
Root (news domain)
  └── Endpoint (listing URL)
        └── Article
              ├── ArticleTitle
              ├── ArticleBlock (JOINED inheritance)
              │     ├── ArticleTextBlock
              │     ├── ArticleImageBlock / VideoBlock / AudioBlock
              └── CacheEndpoint (URL dedup cache)

Post ──► Article (optional)
     └── TelegramPost (optional)
     ├── PostTag
     ├── PostReaction (LIKE/DISLIKE)
     └── PostInteraction (analytics)
```

### 17.2 Telegram Domain

```
TelegramChannel
  ├── TelegramPost (unique: channel_id + telegram_message_id)
  ├── TelegramPostTag
  ├── ChannelTag (sources: QUESTIONNAIRE, ADMIN_DESC, POSTS)
  ├── ChannelPreferenceProfile (fused tag vector)
  ├── TelegramEngagementEvent
  └── TelegramCrawlLog
```

### 17.3 Editorial & Social

```
Topic ──► TopicPost (M:N with Post)
NewsEvent ──► CategoryField
Comment ──► CommentVote
UserPreference (tag weights per user)
UserTelegramContentPreference (Telegram topic vector)
```

### 17.4 Key Tables

| Entity | Table | Notable Fields |
|--------|-------|----------------|
| `Root` | `roots` | baseUrl, status, verification metadata |
| `Endpoint` | `endpoints` | url, crawlScore, lastCrawledAt |
| `Article` | `articles` | url, text, endpoint_id |
| `Post` | `Posts` | tagsExtracted, label, lang |
| `PostTag` | `PostTags` | tag, score |
| `TelegramChannel` | `telegram_channels` | channelUsername, crawlScore, postFrequency |
| `TelegramPost` | `telegram_posts` | content, viewCount, tagsExtracted |
| `Topic` | `topics` | trending stats, status |

**Schema management:** Hibernate `ddl-auto: update` + runtime migrations in `DataInitializer.java`. Bootstrap: `backend/init.sql`.

---

## 18. API Reference Summary

### 18.1 Authentication

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/login` | User login |
| POST | `/auth/signup` | User registration |
| POST | `/auth/limited` | Guest/primitive session |
| POST | `/auth/admin/login` | Admin login (used by crawlers too) |

### 18.2 Content & Feed

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/feed` | Personalized article feed |
| GET | `/api/posts/search` | Full-text search |
| GET | `/articles/{id}/content` | Article block content |
| POST | `/articles` | Create article (crawler) |

### 18.3 Crawler Infrastructure

| Method | Path | Description |
|--------|------|-------------|
| GET/POST | `/roots` | Domain management |
| POST | `/roots/{id}/discover` | Start endpoint discovery |
| GET/POST | `/endpoints` | Listing URL management |
| PATCH | `/endpoints/{id}/crawl-stats` | Update crawl productivity |
| GET/POST | `/cache-endpoints` | URL dedup cache |
| GET | `/api/admin/crawler/*` | Site crawler control proxy |

### 18.4 Telegram

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/telegram/channels/active` | Active channels for crawler |
| POST | `/api/telegram/channels` | Register channel |
| POST | `/api/telegram/posts/bulk` | Bulk post ingestion |
| GET | `/api/telegram/feed/for-you` | Personalized Telegram feed |
| GET | `/api/telegram/feed/by-channel` | Channel-specific feed |
| GET | `/api/telegram/feed/discover` | Content discovery |
| POST | `/api/telegram/interactions/view` | Record view engagement |
| POST | `/api/telegram/interactions/time` | Record read time |
| GET | `/api/admin/telegram-crawler/*` | Crawler control proxy |
| GET | `/api/admin/telegram/*` | Admin analytics & management |

### 18.5 AI (via proxy or direct)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ai/query` | RAG Q&A |
| POST | `/ai/news-brief` | AI news summary |

### 18.6 Admin

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/dashboard/stats` | Dashboard KPIs |
| GET | `/api/admin/analytics/*` | User analytics |
| GET | `/api/admin/telegram/dashboard/kpis` | Telegram ops dashboard |

**Full API docs:** Swagger UI at `http://localhost:8080/swagger-ui/index.html`

---

## 19. Service Manager

**Path:** `service-manager/`

**Type:** Electron desktop application with `node-pty` for terminal management

**Config:** `service-manager/electron/services.json`

**Features:**

- Start/stop individual services or full stack
- Dependency-aware startup order
- Health checks (TCP/HTTP) before marking services healthy
- Log viewing per service
- Port conflict detection

**Recommended startup order ("Start Core Stack"):**

1. MySQL (Docker)
2. Spring Boot API
3. Site Crawler
4. Endpoint Discovery
5. Telegram Crawler
6. Admin Frontend
7. News Feed
8. AI Assistant (optional)
9. Ollama (optional)

---

## 20. Avatar System

### 20.1 Components

| Component | Path | Port |
|-----------|------|------|
| Avatar Speech Server | `avatar/` | 3001 |
| Avatar Studio Component | `avatar-studio-component/` | iframe embed |
| Three.js integration | `news-feed/src/` | — |

### 20.2 Flow

1. News Brief or selected article text sent to avatar speech server
2. TTS generates audio (edge-tts)
3. Rhubarb generates lip-sync viseme data
4. Three.js 3D avatar animates in iframe/modal
5. User sees narrated news presentation

---

## 21. Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Spring Boot as integration hub** | All persistent state in MySQL; Python services are stateless workers |
| **Priority-queue scheduling** | Both crawlers use EMA-based productivity scoring, not fixed cron |
| **Cache-first deduplication** | `cache_endpoints` prevents re-processing known URLs |
| **Graceful degradation** | MTProto → web scraper; curl_cffi → Playwright; LLM down → headline fallback |
| **Service account auth** | Dedicated bootstrap accounts for crawler write access |
| **Microservice separation** | CPU/GPU-heavy NLP in Python; transactional CRUD in Java |
| **Failure isolation** | Crawler crash doesn't affect API; AI down doesn't break feed |

### Failure Impact Matrix

| Failure | Impact | Mitigation |
|---------|--------|------------|
| Site Crawler down | No new web articles | Existing content still served |
| Telegram Crawler down | No new Telegram posts | Same as above |
| AI Assistant down | No Q&A/brief | Feed still works; UI fallback |
| Ollama down | No LLM/embeddings | News brief falls back to headline list |
| MySQL down | Total outage | Docker health checks; dependency order |
| Tag service down | Channel onboarding degraded | Keyword fallback in `ChannelTaggingService` |

---

## 21. Troubleshooting

### Database connection refused

```bash
docker compose -f backend/docker-compose.yml ps
docker compose -f backend/docker-compose.yml logs mysql
```

Ensure port 3307 is not in use by another process.

### Crawler authentication fails (401)

Verify service account credentials match between:
- `application.yml` (`app.bootstrap.crawler-*` / `telegram-crawler-*`)
- Crawler `.env` files (`BACKEND_EMAIL`, `BACKEND_PASSWORD`)

Re-login: crawlers auto-retry on 401 via `BackendClient.login()`.

### ML models fail to load / OOM

Set `SKIP_MODEL_LOAD=1` in crawler environment for development without models.

Ensure sufficient RAM (16 GB+ recommended for full stack).

### Telethon session not authorized

```bash
cd backend/telegram_crawler
python setup_session.py
```

Requires valid `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` from https://my.telegram.org/apps.

### Ollama connection refused

```bash
ollama serve
ollama pull nomic-embed-text
```

Verify port 11434 is reachable: `curl http://localhost:11434/api/tags`

### Frontend CORS / proxy issues

- Admin (`:5173`) calls backend directly — ensure backend is running on `:8080`
- News Feed (`:5174`) uses Vite proxy — check `news-feed/vite.config.js` proxy settings

### Port already in use

```bash
# Find process on port (example: 8080)
ss -tlnp | grep 8080
# or
lsof -i :8080
```

Service Manager can kill conflicting processes before starting services.

### Telegram posts not appearing in feed

1. Verify channel status is `ACTIVE`
2. Check Telegram crawler health: `GET http://localhost:8200/health`
3. Check crawler logs: `GET http://localhost:8200/logs`
4. Verify posts in database: admin Telegram posts page
5. Ensure `TelegramPostTaggingService` has tagged posts (Discover tab needs tags)

### Feed shows no personalized content

- New users see recency-sorted content until interactions build preference vectors
- Interact with posts (view, like, spend time reading) to build `UserPreference` weights
- For Telegram: scroll past posts to trigger view/time engagement signals

---

## 23. Further Documentation

Detailed documentation exists in the repository `docs/` directory:

| Document | Scope |
|----------|-------|
| `docs/system_overview.md` | High-level architecture |
| `docs/system_integration.md` | Cross-service communication |
| `docs/backend_overview.md` | Spring Boot deep dive |
| `docs/frontend_overview.md` | Client applications |
| `docs/site_crawler.md` | Web crawling microservice |
| `docs/endpoint_discovery.md` | Listing page discovery |
| `docs/web_extractor.md` | HTML content extraction |
| `docs/telegram_crawler.md` | Telegram ingestion |
| `docs/recommendation_worker.md` | Personalization subsystems |
| `docs/tag_service.md` | NLP tagging |
| `docs/classifier_service.md` | Category classification |
| `docs/embedding_service.md` | Vector embedding generation |
| `docs/ai_assistant_service.md` | RAG and news brief pipeline |
| `docs/ai_vector_search.md` | Legacy FAISS service |
| `docs/avatar_system.md` | 3D presenter integration |
| `docs/LOCATION_PRIORITIZATION.md` | Geographic feed ranking |
| `news-feed/docs/FEED_ALGORITHM.md` | Feed scoring formula details |

---

## License & Contributing

Refer to the repository for license information and contribution guidelines.

---

*This document was generated from the News Bridge codebase and architecture documentation. For the latest API changes, consult Swagger UI at `http://localhost:8080/swagger-ui/index.html` when the backend is running.*
