# News Bridge — Spring Boot Backend Overview

## 1. Introduction

The Spring Boot backend (`backend/src/main/java/com/example/newscrawler/`) is the authoritative integration layer for the News Bridge platform. It owns all persistent state in MySQL, enforces authentication and authorization, exposes REST APIs consumed by frontends and Python microservices, and proxies administrative control to crawler processes.

**Entry point:** `NewsCrawlerApplication.java`  
**Default port:** 8080  
**Database:** `news_crawler` on MySQL port 3307  
**Schema management:** Hibernate `ddl-auto: update` + runtime migrations in `DataInitializer.java`

---

## 2. Architectural Layers

```
HTTP Request
     │
     ▼
┌─────────────────────────────────────────┐
│  Controller Layer (31 REST controllers) │
│  - Request validation (DTOs)            │
│  - @PreAuthorize role checks            │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Service Layer (~43 services)           │
│  - Business logic                       │
│  - RestTemplate calls to Python svcs    │
│  - Transaction boundaries               │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Repository Layer (~43 JPA repos)       │
│  - Spring Data JPA queries              │
└─────────────────┬───────────────────────┘
                  │
                  ▼
              MySQL (news_crawler)
```

### Package Structure

| Package | Path | Responsibility |
|---------|------|----------------|
| `config` | `.../config/` | Security, OpenAPI, data bootstrap |
| `controller` | `.../controller/` | REST endpoints |
| `dto` | `.../dto/` | Request/response records (~95) |
| `entity` | `.../entity/` | JPA entities and enums (~56) |
| `repository` | `.../repository/` | Data access (~43) |
| `security` | `.../security/` | JWT filter and token provider |
| `service` | `.../service/` | Business logic (~43) |
| `util` | `.../util/` | Helpers (e.g. `TagVectorUtils`) |

---

## 3. Authentication & Authorization

### 3.1 JWT-Based Stateless Auth

Configuration: `SecurityConfig.java`, `JwtTokenProvider.java`, `JwtAuthenticationFilter.java`

- **Session policy:** STATELESS (no server-side sessions)
- **Token signing:** HS512 with configurable secret (`JWT_SECRET`)
- **Expiration:** 24 hours default (`JWT_EXPIRATION=86400000`)
- **Transport:** `Authorization: Bearer <token>` header

### 3.2 JWT Claims

| Claim | Content |
|-------|---------|
| `sub` | User ID |
| `type` | `PRIMITIVE`, `REGISTERED`, `EDITOR`, or `ADMIN` |
| `email` | User email (when applicable) |
| `roles` | List of `UserRole` enum names |
| `createdAt` | Account creation timestamp |

### 3.3 User Types

1. **PrimitiveUser** — Guest sessions via `POST /auth/limited`; synthetic JWT without DB row
2. **RegisteredUser** — Standard accounts (JOINED inheritance on `users` table)
3. **EditorUser** — Editorial accounts with topic/event permissions
4. **Admin** — Separate `admins` table with fine-grained admin roles

### 3.4 Role Model (`UserRole` enum)

Fine-grained permissions include:

- Content: `READ_ARTICLE`, `WRITE_SYSTEM_ARTICLE`, `WRITE_TELEGRAM_POSTS`
- Admin: `MANAGE_USERS`, `CONTROL_CRAWLER`, `MANAGE_TELEGRAM_CHANNELS`
- Editorial: topic assignment, publish request approval
- System: `READ_SYSTEM_METADATA`, `OWNER`

If JWT contains `OWNER`, all roles are granted at filter time.

### 3.5 Bootstrap Service Accounts

Created by `DataInitializer.java` on startup:

| Account | Email Config | Roles |
|---------|--------------|-------|
| Owner | `app.bootstrap.owner-email` | Full admin including `OWNER` |
| Web Crawler | `app.bootstrap.crawler-email` | `WRITE_SYSTEM_ARTICLE`, `READ_SYSTEM_METADATA` |
| Telegram Crawler | `app.bootstrap.telegram-crawler-email` | `WRITE_TELEGRAM_POSTS`, `READ_SYSTEM_METADATA` |

Python crawlers authenticate via `POST /auth/admin/login` using these credentials.

### 3.6 MFA & Device Tracking

`AuthController` supports multi-factor verification with `LoginDevice` entity tracking trusted devices.

### 3.7 Public Endpoints (permitAll)

- All `/auth/**` routes
- Swagger UI (`/swagger-ui/**`, `/v3/api-docs/**`)
- Selected GET endpoints: article content/media/blocks, feed, telegram feed, public events, comments (read)
- Upload endpoints (`/api/upload/**`)

All other routes require authentication.

---

## 4. Domain Model & Database Schema

### 4.1 Core Content Graph

```
Root (news domain)
  └── Endpoint (listing URL to crawl)
        └── Article
              ├── ArticleTitle
              ├── ArticleBlock (JOINED inheritance)
              │     ├── ArticleTextBlock
              │     ├── ArticleImageBlock / VideoBlock / AudioBlock / ...
              └── CacheEndpoint (dedup cache per source)

Post ──► Article (optional link)
     └── TelegramPost (optional link)
     ├── PostTag
     ├── PostReaction (LIKE/DISLIKE)
     └── PostInteraction (view/time/click analytics)
```

### 4.2 Editorial & Social

```
Topic ──► TopicPost (M:N with Post)
      └── topic_fields (M:N CategoryField)
NewsEvent ──► CategoryField
          └── PublishPermissionRequest

Comment ──► CommentVote
UserPreference (tag weights per user)
```

### 4.3 Telegram Domain

```
TelegramChannel
  ├── TelegramPost (unique per channel + message_id)
  ├── ChannelTag (sources: ADMIN_DESC, TAG_SERVICE, POSTS, QUESTIONNAIRE)
  ├── ChannelPreferenceProfile (tag vector for recommendations)
  └── UserChannelPreference
```

### 4.4 Key Entity Tables

| Entity | Table | Notable Fields |
|--------|-------|----------------|
| `Root` | `roots` | baseUrl, status, verification metadata |
| `Endpoint` | `endpoints` | url, crawlScore, lastCrawledAt, root_id |
| `Article` | `articles` | url, text, endpoint_id |
| `Post` | `Posts` | tagsExtracted, label (category), lang |
| `PostTag` | `PostTags` | tag name, score |
| `TelegramChannel` | `telegram_channels` | channelUsername, crawlPriority, postFrequency |
| `Topic` | `topics` | trending stats, status |
| `NewsEvent` | `news_events` | visibility: DRAFT / EDITOR_VISIBLE / PUBLIC |

Schema bootstrap: `backend/init.sql` creates databases; Hibernate manages table DDL.

---

## 5. Controller & API Structure

### 5.1 Authentication

| Controller | Base Path | Key Endpoints |
|------------|-----------|---------------|
| `AuthController` | `/auth` | login, signup, verify-email, MFA, forgot-password |
| `AdminAuthController` | `/auth/admin` | admin login |

### 5.2 Content & Feed

| Controller | Base Path | Purpose |
|------------|-----------|---------|
| `ArticleController` | `/articles` | CRUD, blocks, media, content assembly |
| `PostController` | `/api/posts` | Post CRUD, reactions, tag queries |
| `FeedController` | `/api` | Personalized feed, brief data, interactions |
| `SearchController` | `/api/posts/search` | Full-text search |
| `CommentController` | `/api/comments` | Threaded comments with voting |

### 5.3 Crawler Infrastructure

| Controller | Base Path | Purpose |
|------------|-----------|---------|
| `RootController` | `/roots` | Domain registration, discovery jobs, bulk endpoints |
| `EndpointController` | `/endpoints` | Listing URL management, crawl stats |
| `CacheEndpointController` | `/cache-endpoints` | URL deduplication cache |
| `CrawlerAdminController` | `/api/admin/crawler` | Proxy to Python site crawler |

### 5.4 Telegram

| Controller | Base Path | Purpose |
|------------|-----------|---------|
| `TelegramChannelController` | `/api/telegram/channels` | Channel CRUD, crawl stats |
| `TelegramPostController` | `/api/telegram/posts` | Bulk post ingestion |
| `TelegramFeedController` | `/api/telegram/feed` | Public Telegram feed |
| `TelegramCrawlerAdminController` | `/api/admin/telegram-crawler` | Crawler control proxy |
| `ChannelOnboardingController` | `/api/telegram/onboarding` | Preference questionnaire |

### 5.5 Editorial & Topics

| Controller | Base Path | Purpose |
|------------|-----------|---------|
| `TopicController` | `/api/topics` | Trending topics, editor assignments |
| `NewsEventController` | `/api/events` | Editorial events with publish workflow |
| `CategoryFieldController` | `/api/fields` | Category taxonomy |

### 5.6 Admin & Analytics

| Controller | Base Path | Purpose |
|------------|-----------|---------|
| `AdminController` | `/api/admin` | Admin user management |
| `AdminManagementController` | `/api/admin/management` | Activity logs, permission groups |
| `UserManagementController` | `/api/admin/manage` | Registered/editor user admin |
| `UserAnalyticsController` | `/api/admin/analytics` | Growth, activity, preferences |
| `DashboardController` | `/api/admin/dashboard` | Aggregate stats |

---

## 6. Service Layer Highlights

### 6.1 Content Services

- **`ArticleService`** — Creates articles from crawler payloads; assembles block-based content
- **`PostService`** — Creates feed posts from articles; manages tag extraction flag
- **`FeedService`** — Builds personalized feed with category/location filtering
- **`SearchService`** — Database-backed post search

### 6.2 Crawler Integration Services

#### CrawlerAdminService → Site Crawler (:8000)

```java
// Proxies to Python crawler_server
health()           → GET  /health
runNow()           → POST /run-now
schedulerStatus()  → GET  /control/status
startScheduler()   → POST /control/start
stopScheduler()    → POST /control/stop
setInterval()      → POST /control/interval
runEndpointNow()   → POST /control/run-endpoint
```

Config: `crawler.server.base-url` (default `http://127.0.0.1:8000`)

#### RootDiscoveryService → Endpoint Discovery (:8004)

```java
startDiscovery()     → POST /discover/start  {root_url, max_depth}
assessEndpoint()   → POST /assess/endpoint  {url, root_url}
pollDiscoveryJob() → GET  /discover/jobs/{jobId}
```

Also calls Wayback CDX API and Wikidata SPARQL for root verification.

#### TelegramCrawlerAdminService → Telegram Crawler (:8200)

Same control pattern plus `reloadChannels()` and `searchChannels()`.

Config: `telegram-crawler.server.base-url` (default `http://localhost:8200`)

#### ChannelTaggingService → Tag Service (:8001)

```java
callTagService(text) → POST /extract-tags {"text": "..."}
```

Used for Telegram channel description tagging with keyword fallback.

### 6.3 Personalization Services

- **`ChannelScoringService`** — Computes Telegram channel crawl priority and user-channel affinity via tag vector similarity
- **`ChannelProfileService`** — Builds channel preference profiles from onboarding answers
- **`UserIntelligenceService`** — Aggregates user behavior profiles

### 6.4 Scheduled Tasks

- **`TopicStatsScheduler`** — Recalculates topic trending statistics every 60 seconds (`@Scheduled`)

---

## 7. External Service Connections

```
┌─────────────────────────┐
│  Spring Boot Backend    │
│  (default :8080)        │
└───────────┬─────────────┘
            │ RestTemplate HTTP
    ┌───────┼───────────┬────────────────┐
    ▼       ▼           ▼                ▼
 :8000   :8001       :8004            :8200
crawler  tag       endpoint-      telegram-
server   service   discovery      crawler
```

**Reverse direction (Python → Java):**

| Service | Auth | Write Endpoints |
|---------|------|-----------------|
| Site Crawler | crawler-service account | `POST /articles`, `POST /cache-endpoints`, `PATCH /endpoints/{id}/crawl-stats` |
| Telegram Crawler | telegram-crawler account | `POST /api/telegram/posts/bulk`, `PATCH /api/telegram/channels/{id}/crawl-stats` |

**Not integrated from Java:** `ai-assistant-service` and `ai-service` are called directly by frontends, not proxied through Spring Boot (except public feed data they read).

---

## 8. Request Lifecycle Example: Article Creation

```
1. Site Crawler worker finishes extracting article HTML
2. CrawlerService calls BackendClient.create_article(payload)
3. BackendClient POST /auth/admin/login → receives JWT
4. POST /articles with Bearer token
5. JwtAuthenticationFilter validates token, loads UserDetails
6. @PreAuthorize checks WRITE_SYSTEM_ARTICLE role
7. ArticleController receives CreateArticleRequest DTO
8. ArticleService:
   a. Creates Article entity with url, endpoint_id
   b. Persists ArticleTitle, ArticleBlock subtypes
   c. Creates linked Post entity (tagsExtracted=false)
9. JPA flush → MySQL commit
10. Response: ArticleResponse with article ID
11. post_processor (10s later) picks up post, classifies, tags
```

---

## 9. Configuration Reference

**File:** `backend/src/main/resources/application.yml`

| Section | Key Settings |
|---------|--------------|
| `spring.datasource` | MySQL on port 3307, user `news_user` |
| `spring.jpa` | `ddl-auto: update`, `open-in-view: false` |
| `spring.security.jwt` | Secret and expiration |
| `app.bootstrap` | Owner and service account credentials |
| `crawler.server.base-url` | Site crawler URL |
| `telegram-crawler.server.base-url` | Telegram crawler URL |
| `tag.service.base-url` | Tag service URL |
| `endpoint-discovery.server.base-url` | Discovery service URL |
| `wayback.api.cdx-url` | Wayback verification API |

Environment overrides: `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`, `JWT_SECRET`, `JPA_DDL_AUTO`.

---

## 10. Data Initialization

`DataInitializer.java` runs on startup:

1. Drops legacy columns from `users`
2. Migrates role columns to `VARCHAR(100)`
3. Seeds ~16 top-level category fields with 100+ sub-fields
4. Seeds allowed roles per user type
5. Creates owner + crawler service admin accounts
6. Cleans up expired primitive users

---

## 11. OpenAPI Documentation

Swagger UI available at `/swagger-ui/` with bearer JWT security scheme configured in `OpenApiConfig.java`.
