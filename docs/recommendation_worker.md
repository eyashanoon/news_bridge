# Recommendation & Personalization Subsystem

## 1. Overview

News Bridge does not implement a standalone microservice named "recommendation worker." Instead, **personalization and recommendation logic is distributed** across the Spring Boot backend (channel scoring, user preferences, feed construction) and the AI Assistant service (news brief scoring). This document reconstructs the complete recommendation architecture as a unified subsystem.

---

## 2. Subsystem Components

```
┌─────────────────────────────────────────────────────────────────┐
│                  RECOMMENDATION SUBSYSTEM                        │
├─────────────────────────────────────────────────────────────────┤
│  Spring Boot Backend                                            │
│  ├── ChannelScoringService      (Telegram crawl priority)       │
│  ├── ChannelProfileService      (channel tag vectors)           │
│  ├── ChannelOnboardingService   (preference questionnaire)      │
│  ├── UserPreferenceService      (user tag weights)              │
│  ├── FeedService                (feed ranking)                    │
│  └── TopicStatsScheduler        (trending topic scoring)        │
├─────────────────────────────────────────────────────────────────┤
│  AI Assistant Service (:9000)                                   │
│  └── NewsBriefService           (personalized brief scoring)    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. User Preference Model

### 3.1 Entity: UserPreference

**Table:** `UserPreferences`

Stores weighted tag preferences per user, built from:
- Explicit category selections during onboarding
- Implicit signals from post reactions (LIKE/DISLIKE)
- Comment and view interactions tracked via `PostInteraction`

### 3.2 Tag Vector Representation

**Utility:** `backend/src/main/java/.../util/TagVectorUtils.java`

```java
// Parse stored JSON tag vector
Map<String, Double> vector = TagVectorUtils.parseVector(jsonString);

// Compute cosine-like similarity between two tag vectors
double similarity = TagVectorUtils.similarity(vectorA, vectorB);
```

Used for matching user preferences against channel profiles and post tags.

### 3.3 API Access

```
GET /api/users/{userId}/preferences
→ { tags: {"Politics": 0.8, "Technology": 0.5}, categories: {...} }
```

AI Assistant fetches preferences for news brief personalization.

---

## 4. Channel Scoring System (Telegram)

### 4.1 ChannelScoringService

**File:** `backend/src/main/java/.../service/ChannelScoringService.java`

Computes crawl priority for Telegram channels consumed by Python scheduler:

```java
public double computeCrawlPriority(TelegramChannel ch) {
    double score = ch.getCrawlScore();

    // Posting frequency boost (0–5)
    score += Math.min(5.0, ch.getPostFrequency() * 2.0);

    // Engagement boost (0–3)
    score += Math.min(3.0, Math.log1p(ch.getAvgViewCount()) / 5.0);

    // Recency staleness bonus
    if (ch.getLastCrawledAt() != null) {
        double hours = Duration.between(ch.getLastCrawledAt(), Instant.now()).toHours();
        score += Math.sqrt(Math.max(0, hours)) * 0.5;
    } else {
        score += 50.0;  // never crawled — high urgency
    }

    // Onboarding completeness
    if (ch.isOnboardingCompleted()) {
        score += 2.0;
    }

    return score;
}
```

### 4.2 Waitlist Determination

```java
public boolean isWaitlist(TelegramChannel ch) {
    return computeCrawlPriority(ch) < 2.0 && ch.getTotalCrawls() > 3;
}
```

Low-priority channels with sufficient crawl history enter waitlist rotation in Python scheduler.

### 4.3 User-Channel Affinity

```java
public double userChannelAffinity(TelegramChannel ch, Map<String, Double> userPrefs) {
    return profileRepo.findByChannel_Id(ch.getId())
        .map(p -> TagVectorUtils.similarity(
            TagVectorUtils.parseVector(p.getFinalTagVector()),
            userPrefs))
        .orElse(0.0);
}
```

Semantic similarity between channel preference profile and user tag weights.

---

## 5. Channel Preference Profiles

### 5.1 Entity: ChannelPreferenceProfile

**Table:** `channel_preference_profiles`

Built during channel onboarding questionnaire:
1. Admin/user answers preference questions via `ChannelOnboardingController`
2. Answers mapped to category field weights
3. Channel tags extracted via `ChannelTaggingService` (tag service + keyword fallback)
4. Combined into `finalTagVector` JSON stored on profile

### 5.2 Onboarding Flow

**Controller:** `ChannelOnboardingController` at `/api/telegram/onboarding`

```
POST /next-question     → adaptive questionnaire
GET  /start             → initial question set
POST /channels/{id}/complete → finalize profile
GET  /channels/{id}/profile  → retrieve profile
```

**Service:** `ChannelOnboardingService`, `ChannelProfileService`

### 5.3 Tag Sources for Channels

**Entity:** `ChannelTag` with source enum:
- `ADMIN_DESC` — manually entered description
- `TAG_SERVICE` — NLP extraction from description
- `POSTS` — aggregated from recent post tags
- `QUESTIONNAIRE` — derived from onboarding answers

---

## 6. Feed Personalization (Spring Boot)

### 6.1 FeedService

**File:** `backend/src/main/java/.../service/FeedService.java`

Constructs personalized feed via `GET /api/feed`:

**Inputs:**
- User ID (from JWT)
- Optional category filter
- Optional geolocation (lat/lon for location-aware content)

**Ranking factors:**
- Post recency (timestamp ordering with decay)
- User preference tag overlap
- Category affinity
- Post popularity (reactions)
- Content freshness (tagsExtracted flag ensures enriched posts preferred)

### 6.2 Interaction Tracking

**Controller:** `FeedController`

```
POST /posts/{id}/view    → record view event
POST /posts/{id}/time    → record dwell time
POST /posts/{id}/click   → record click-through
PUT  /posts/{id}/react   → LIKE/DISLIKE
```

**Entity:** `PostInteraction` — feeds into `UserActivityMetricsService` and preference learning.

---

## 7. News Brief Scoring (AI Assistant)

### 7.1 NewsBriefService

**File:** `backend/ai-assistant-service/logic/news_brief_service.py`

Primary **content recommendation engine** for the AI news brief panel.

### 7.2 Scoring Formula

```python
total_score = 0.40 × preference_affinity
            + 0.35 × recency_score
            + 0.25 × importance_score
```

#### Preference Affinity (40%)

```python
tag_score = sum(weighted_tags.get(tag, 0) for tag in post_tags) / len(post_tags)
category_score = weighted_categories.get(post.category, 0)
affinity = 0.6 × tag_score + 0.4 × category_score
```

Neutral score (0.3) when user has no preferences.

#### Recency (35%)

Exponential decay with 4-hour half-life:

```python
recency = exp(-ln(2) × hours_ago / 4)
```

#### Importance (25%)

```python
importance = likes / (likes + dislikes)  # ratio-based
# Default 0.3 when no reactions
```

### 7.3 Brief Generation Pipeline

```
1. Fetch user preferences from backend
2. Fetch recent posts (≤ 12 hours)
3. Score all candidates
4. Select top min_posts..max_posts (default 5–12)
5. Generate LLM-written brief from selected headlines
6. Return {posts, brief_text, average_score, total_candidates}
```

**API:** `POST /news-brief` with optional `X-User-Id` and `X-Language` headers.

---

## 8. Trending Topic Scoring

### 8.1 TopicStatsScheduler

**File:** `backend/src/main/java/.../service/TopicStatsScheduler.java`

Runs every 60 seconds (`@Scheduled`):

```
1. Load all active topics
2. Count associated posts in rolling windows
3. Compute velocity (posts per hour)
4. Update topic trending metrics
5. Persist to topics table
```

**Consumed by:** `TrendingTopics.jsx` in news feed via `GET /api/topics`.

---

## 9. Embedding Updates

While not a dedicated worker, embedding refresh occurs through:

### 9.1 AI Assistant Ingestion Scheduler

**File:** `backend/ai-assistant-service/rag/scheduler.py`

```python
class IngestionScheduler:
    # Every AI_ASSISTANT_AUTO_INGEST_INTERVAL_MINUTES (default 15)
    # Ingests posts from last 24 hours into FAISS
```

Ensures vector store reflects latest content for semantic Q&A.

### 9.2 On-Demand Ingestion

Query pipeline ingests candidate posts before vector search:

```python
# query_service.py
posts = await backend.fetch_posts_by_tags(tags)
await ingester.ingest_posts(posts)  # embed + store
results = vector_store.search(query_embedding, top_k)
```

---

## 10. Periodic Job Scheduling Summary

| Job | Location | Interval | Purpose |
|-----|----------|----------|---------|
| Topic stats | `TopicStatsScheduler` | 60s | Trending topic metrics |
| News brief | On-demand (frontend) | User-triggered | Personalized AI summary |
| FAISS ingest | `IngestionScheduler` | 15 min | Vector store refresh |
| Channel reload | Telegram crawler thread | 120s | Channel list sync |
| Post classify/tag | `post_processor` in site crawler | 10s | Enrichment for feed ranking |

---

## 11. Integration with Embedding Service

Recommendation scoring uses **tag/category overlap** (symbolic) rather than embedding similarity for feed ranking. Embedding-based retrieval is used in:

- AI Q&A query pipeline (semantic search over FAISS)
- Potential future enhancement: embedding-based feed ranking

Current architecture deliberately separates:
- **Fast symbolic matching** for feed/brief (tag weights)
- **Semantic matching** for Q&A (vector similarity)

---

## 12. Data Flow: Personalized Brief

```
User opens News Feed
         │
         ▼
NewsBrief.jsx mounts → POST /ai/news-brief
  headers: X-User-Id, X-Language
         │
         ▼
NewsBriefService.generate_brief()
         │
         ├── GET /api/users/{id}/preferences  (tag weights)
         ├── GET recent posts from backend
         ├── Score: 40% pref + 35% recency + 25% importance
         ├── Select top 5–12 posts
         └── LLM generates narrative brief
         │
         ▼
Frontend displays brief_text + scored post cards
```

---

## 13. Design Rationale

1. **No monolithic recommendation worker** — scoring logic lives close to data (Java for feed, Python for AI brief) avoiding cross-service latency.
2. **Tag vectors over embeddings for feed** — faster, interpretable, works without GPU/Ollama.
3. **Channel scoring drives crawl priority** — ensures high-value Telegram sources polled more frequently.
4. **Interaction feedback loop** — reactions and dwell time inform future preference weights.
