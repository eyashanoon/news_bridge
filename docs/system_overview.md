# News Bridge — System Overview

## 1. Introduction

News Bridge is a distributed news aggregation, enrichment, and consumption platform. It continuously ingests content from **web news sites** and **Telegram channels**, classifies and tags articles, stores structured content in a central relational database, generates vector embeddings for semantic search, and exposes personalized feeds and AI-assisted reading experiences through web and mobile clients.

The platform deliberately splits responsibilities across:

- A **Java Spring Boot backend** (port 8080) as the system of record, authentication hub, and REST API gateway.
- Multiple **Python microservices** for crawling, NLP, classification, and AI/RAG.
- **React/Vite frontends** for administration and consumer news consumption.
- An **Expo/React Native mobile app** mirroring the consumer experience.
- **Ollama** (port 11434) as the local LLM and embedding runtime.

Operational orchestration is supported by the **Service Manager** desktop application (`service-manager/`), which starts MySQL, the backend, crawlers, frontends, and AI services in dependency order.

---

## 2. System Goals

| Goal | Mechanism |
|------|-----------|
| Automated news ingestion | Site crawler + Telegram crawler continuously poll configured sources |
| Structured article storage | Deep-learning HTML extractor produces title, text blocks, and media |
| Content enrichment | Classifier assigns category labels; tag service extracts entities/keywords |
| Semantic discovery | FAISS vector stores + Ollama embeddings power Q&A and news briefs |
| Personalization | User preference vectors, feed scoring, channel affinity profiles |
| Editorial workflow | Topics, news events, editor assignments, publish approval flows |
| Multilingual support | Arabic/English NLP pipelines, i18n in frontends, RTL layout |
| Administrative control | Admin console for roots, endpoints, crawlers, users, analytics |

---

## 3. Subsystem Map

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

### Shared Python Libraries (not standalone services)

| Library | Path | Role |
|---------|------|------|
| `web_fetch` | `backend/web_fetch/` | Anti-bot HTML fetching (curl_cffi + Playwright) |
| `extractor` | `backend/extractor/` | DL-based article content extraction |
| `post_processor` | `backend/post_processor.py` | Embedded batch classifier + tagger (runs inside site crawler) |

---

## 4. End-to-End Pipeline

The following describes the complete lifecycle of a web-sourced news article from discovery to user display.

### Phase 1 — Source Registration (Admin)

1. An administrator registers a **Root** (news domain) via `POST /roots` in the Spring Boot API.
2. **Endpoint discovery** (`endpoint_discovery/`, port 8004) performs BFS crawling within the domain, classifying pages as listing vs. article vs. other using an XLM-RoBERTa page classifier.
3. Discovered listing URLs are bulk-imported as **Endpoints** via `POST /roots/{id}/endpoints/bulk`.
4. Root verification may consult Wayback Machine CDX and Wikidata SPARQL for trust assessment.

### Phase 2 — Continuous Web Crawling

1. The **Site Crawler** (`crawler_server/`, port 8000) maintains a pool of worker threads (`CRAWLER_NUM_CHANNELS`, default 3).
2. Each worker selects the highest-priority **Endpoint** using:
   ```
   priority = EMA(articles_found) + sqrt(hours_since_last_crawl) × staleness_weight
   ```
   Never-crawled endpoints receive urgency boost `9999 + score`.
3. For each listing page:
   - Fetch HTML via `web_fetch.fetch_soup`
   - Extract all `<a href>` links
   - Bulk-load cached URLs from backend (`GET /cache-endpoints/urls-by-source`)
   - Process only **new** URLs
4. For each candidate URL:
   - **Page classifier** (`endpoint_discovery/page_classifier`) determines if URL is an article
   - If article: **extractor** (`extract_article`) parses HTML into structured blocks
   - Persist via `POST /articles` and `POST /cache-endpoints`
5. Every 10 seconds, **post_processor** classifies and tags pending posts directly in MySQL.

### Phase 3 — Telegram Ingestion (Parallel Track)

1. **Telegram Crawler** (`telegram_crawler/`, port 8200) loads active channels from `GET /api/telegram/channels/active`.
2. Worker threads assign channels by priority (backend `crawlPriority` + EMA + staleness + cooldown).
3. Posts fetched via Telethon MTProto; web scraper fallback if MTProto unavailable.
4. Bulk submission via `POST /api/telegram/posts/bulk`.
5. Channel tags extracted via tag service during onboarding (`ChannelTaggingService`).

### Phase 4 — Enrichment & Indexing

1. **Classifier** assigns category label (Politics, Sports, Technology, etc.) to each post.
2. **Tag extraction** produces named entities and YAKE keywords (EN/AR).
3. Posts become feed items with tags, category, reactions, and interaction metrics.
4. **AI Assistant** (`ai-assistant-service/`, port 9000) periodically ingests recent posts into FAISS vector store.

### Phase 5 — Consumption

1. **News Feed** web app calls `GET /api/feed` with optional location and category filters.
2. **News Brief** panel calls `POST /ai/news-brief` for personalized AI summary.
3. **ChatWidget** calls `POST /ai/query` for RAG-based Q&A on selected posts.
4. **Avatar Presenter** (iframe) can narrate news via TTS + lip-sync animation.

---

## 5. Data Flow Diagram (Textual)

```
[Admin registers Root URL]
         │
         ▼
[Endpoint Discovery :8004] ──BFS + page_classifier──► [Listing Endpoints in MySQL]
         │
         ▼
[Site Crawler :8000] ──fetch listing──► [Extract links]
         │
         ├──► [Page Classifier] ──is_article?──► [Extractor] ──structured article──► [POST /articles]
         │
         └──► [Cache Endpoint] ──skip on re-crawl──► [MySQL cache_endpoints]
         
[post_processor every 10s] ──► [classify + tag] ──► [posts.label, post_tags]

[Telegram Crawler :8200] ──MTProto/scraper──► [POST /api/telegram/posts/bulk]

[AI Assistant :9000] ──ingest scheduler──► [FAISS index + meta.json]
         │
         └──► [Ollama embeddings + LLM generation]

[News Feed :5174] ──JWT──► [Spring Boot :8080] ──► [MySQL]
         │
         └──► [/ai proxy] ──► [AI Assistant :9000]
```

---

## 6. Technology Stack Summary

| Layer | Technologies |
|-------|-------------|
| Backend API | Java 17, Spring Boot 3.5, Spring Security JWT, Spring Data JPA, MySQL |
| Crawlers | Python 3, FastAPI, uvicorn, APScheduler, Telethon |
| ML/NLP | PyTorch, HuggingFace Transformers, XLM-RoBERTa, BERT-NER, YAKE |
| Vector Search | FAISS (IndexFlatIP), Ollama nomic-embed-text (768-dim) |
| LLM | Ollama (configurable model, e.g. llama3) |
| Admin Frontend | React 19, Vite 8, axios, React Router 7 |
| News Feed Web | React 19, Vite 7, Tailwind 4, i18next, Three.js (avatar) |
| Mobile | Expo 56, React Native 0.85, React Navigation 7 |
| Infrastructure | Docker MySQL, Service Manager (Electron + node-pty) |

---

## 7. Port & Service Registry

Defined in `service-manager/electron/services.json`:

| Service | Port | Entry Point |
|---------|------|-------------|
| MySQL | 3307 | `docker compose up mysql` |
| Spring Boot API | 8080 | `mvn spring-boot:run` |
| Site Crawler | 8000 | `backend/crawler_server/main.py` |
| Tag Service | 8001 | `backend/tag_service/app.py` |
| Classifier Service | 8002 | `backend/classifier_service/news_classifier_app.py` |
| Endpoint Discovery | 8004 | `backend/endpoint_discovery/service.py` |
| Telegram Crawler | 8200 | `backend/telegram_crawler/main.py` |
| AI Assistant | 9000 | `backend/ai-assistant-service/main.py` |
| AI Service (legacy) | 9001 | `backend/ai-service/main.py` |
| Admin Frontend | 5173 | `frontend/` |
| News Feed | 5174 | `news-feed/` |
| Ollama | 11434 | `ollama serve` |

---

## 8. Key Design Principles

1. **Spring Boot as integration hub** — All persistent state lives in MySQL; Python services are stateless workers except for local FAISS indices and crawler session scores.
2. **Priority-queue scheduling** — Both site and Telegram crawlers use continuous worker pools with EMA-based productivity scoring rather than fixed cron intervals.
3. **Cache-first deduplication** — `cache_endpoints` table prevents re-processing known URLs, dramatically reducing classifier and extractor load.
4. **Graceful degradation** — MTProto → web scraper fallback; curl_cffi → Playwright fallback; LLM unavailable → headline-list fallback for news briefs.
5. **Service account authentication** — Dedicated bootstrap accounts (`crawler-service@news.local`, `telegram-crawler@news.local`) authenticate crawlers to write system content.
6. **Microservice separation by workload** — CPU/GPU-heavy NLP and I/O-heavy crawling run in Python; transactional CRUD and authorization run in Java.

---

## 9. Repository Layout (Active Components)

```
news_bridge/
├── backend/                    # Java Spring Boot + Python microservices
│   ├── src/main/java/          # Spring Boot application
│   ├── crawler_server/         # Site crawler (:8000)
│   ├── endpoint_discovery/     # BFS listing discovery (:8004)
│   ├── telegram_crawler/       # Telegram crawler (:8200)
│   ├── tag_service/            # Tag extraction API (:8001)
│   ├── classifier_service/     # Category classifier (:8002)
│   ├── ai-assistant-service/   # Primary RAG service (:9000)
│   ├── ai-service/             # Legacy vector search (:9001)
│   ├── web_fetch/              # Shared fetch library
│   ├── extractor/              # Shared extraction library
│   └── post_processor.py       # Embedded enrichment pipeline
├── frontend/                   # Admin React app
├── news-feed/                  # Consumer web app + mobile/
├── avatar-studio-component/    # 3D avatar iframe package
└── service-manager/            # Desktop orchestration tool
```

---

## 10. Related Documentation

| Document | Scope |
|----------|-------|
| `backend_overview.md` | Spring Boot architecture in depth |
| `frontend_overview.md` | All client applications |
| `system_integration.md` | Cross-service communication and scheduling |
| `site_crawler.md` | Web crawling microservice |
| `endpoint_discovery.md` | Listing page discovery |
| `web_extractor.md` | HTML content extraction |
| `telegram_crawler.md` | Telegram ingestion |
| `recommendation_worker.md` | Personalization and scoring subsystems |
| `tag_service.md` | NLP tagging |
| `classifier_service.md` | Category classification |
| `embedding_service.md` | Vector embedding generation |
| `ai_assistant_service.md` | RAG and news brief pipeline |
| `ai_vector_search.md` | Legacy FAISS service |
| `avatar_system.md` | 3D presenter integration |
