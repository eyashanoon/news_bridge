# News Feed Ranking Algorithm

This document describes the algorithm that determines how posts are ordered in a user's feed within the News Bridge application.

## High-Level Overview

The feed is computed **server-side** (Java/Spring Boot backend) and served via a REST API (`GET /api/feed`). The algorithm takes a **personalized, multi-signal approach**: it scores each candidate post based on **user affinity** (learned interests), **recency**, **popularity**, **geographic proximity**, and a small **exploration factor**. Posts are then sorted by their composite score in descending order, with already-seen posts filtered out.

---

## 1. Data Flow

### Client Request (`Feed.jsx`)

```
GET /api/feed?userId={id}&category={category}&limit=10&page={page}&lat={lat}&lon={lon}
```

- `userId` — anonymized user ID for personalization
- `category` — "General" (all categories) or a specific category (e.g. "Politics", "Sports")
- `limit` — number of posts per page
- `page` — 0-indexed page number for offset-based pagination
- `lat`/`lon` — user's geographic coordinates for location-based ranking (optional)

The frontend uses an **IntersectionObserver** on a sentinel element at the bottom of the feed to trigger infinite scroll — when the sentinel enters the viewport, it fetches the next page.

### Server Endpoint (`FeedController.java`)

1. Resolves or creates the `AppUser` entity for the given `userId`
2. Delegates to `FeedService.getFeed(user, category, limit, page)`

---

## 2. Candidate Selection

Before scoring, the backend selects a set of candidate posts from the database:

1. **Fetch User Preferences** — the top 20 preference tags (by weight) for the user are loaded.
2. **Fetch Seen Post IDs** — all post IDs that the user has previously viewed/interacted with are retrieved.
3. **Query Posts** (paginated by `createdAt DESC`):
   - If the user has **no interactions yet**: query all posts matching the category (or all if "General").
   - If the user has **interactions**: exclude already-seen posts (`id NOT IN seenPostIds`).
4. **Bulk Load Tags** — all `PostTag` entries for the candidate posts are fetched in one query.
5. **Bulk Load Reaction Counts** — like/dislike counts are aggregated for all candidates.
6. **Bulk Load User Reactions** — the user's own reactions (like/dislike) to the candidate posts.

---

## 3. Scoring Formula

Each candidate post is assigned a **composite score** using this weighted formula:

```
score = 0.45 × tagAffinity
      + 0.25 × categoryAffinity
      + 0.15 × recency
      + 0.10 × popularity
      + 0.05 × exploration
```

### Weight Breakdown

| Component | Weight | Description |
|-----------|--------|-------------|
| **Tag Affinity** | **0.45** | How closely the post's tags match the user's learned interests |
| **Category Affinity** | **0.25** | How much the user prefers the post's main category |
| **Recency** | **0.15** | How recently the post was created (time decay) |
| **Popularity** | **0.10** | The like-to-dislike ratio of the post |
| **Exploration** | **0.05** | A random factor to introduce diversity |

---

## 4. Component Calculations in Detail

### 4.1 Tag Affinity (45%)

Each user has a set of **`UserPreference`** entries — key-value pairs of `(tag → weight)` that represent their learned interest in specific tags (e.g. "gaza", "football", "economy", "cairo").

```java
double tagAffinity = 0;
for (String tag : postTags) {
    tagAffinity += prefMap.getOrDefault(tag.toLowerCase(), 0.0);
}
```

The affinity is simply the **sum** of the user's preference weights for all tags assigned to the post. Posts with more tags that match the user's interests score higher.

### 4.2 Category Affinity (25%)

Each post has a main `label` (category) such as "Politics", "Sports", "Technology". The algorithm checks if the user has a preference weight for that category:

```java
double categoryAffinity = prefMap.getOrDefault(post.getLabel().toLowerCase(), 0.0);
```

This ensures that a user who clicks on many sports posts will see more sports posts near the top.

### 4.3 Recency (15%)

A decaying exponential function that gives higher scores to newer posts:

```java
private double recencyScore(LocalDateTime createdAt) {
    long hours = Duration.between(createdAt, LocalDateTime.now()).toHours();
    return Math.exp(-hours / 48.0);
}
```

- Posts created **0 hours ago**: score = `exp(0)` = **1.0**
- Posts created **24 hours ago**: score = `exp(-0.5)` ≈ **0.606**
- Posts created **48 hours ago**: score = `exp(-1.0)` ≈ **0.367**
- Posts created **7 days ago**: score = `exp(-3.5)` ≈ **0.030**

The half-life is approximately **33 hours**, meaning after about 33 hours a post's recency score is halved.

### 4.4 Popularity (10%)

Based on the **like-to-dislike ratio** using additive smoothing:

```java
private double popularityScore(long likes, long dislikes) {
    return (likes + 1.0) / (likes + dislikes + 2.0);
}
```

This produces a value in the range (0, 1):
- **No reactions**: `(0+1)/(0+2)` = **0.5** (neutral starting point)
- **10 likes, 0 dislikes**: `(10+1)/(10+2)` = **0.916**
- **0 likes, 10 dislikes**: `(0+1)/(10+2)` = **0.083**

The additive smoothing ensures posts with few reactions start at a neutral score and avoid extreme values.

### 4.5 Exploration (5%)

A purely random component:

```java
double exploration = Math.random() * 0.2;
```

This contributes **0–0.2** to the score, which has a small but non-zero chance of pushing a lower-scored post above others. It prevents the feed from becoming too narrow and helps the system discover new user interests.

---

## 5. Location-Based Geographic Prioritization

When the user provides their location (`lat`/`lon`), a **geographic multiplier** is applied to the base score. This is handled by the Python microservice at `backend/ai-service/ingestion/geo_extractor.py` (intended to be integrated post-scoring).

### Distance Tiers (Non-Sports Categories)

| Distance from User | Multiplier | Description |
|--------------------|------------|-------------|
| < 15 km | 10.0× | Same city |
| < 50 km | 7.0× | Nearby cities |
| < 150 km | 5.0× | Same region |
| < 500 km | 3.0× | Whole country |
| < 1,500 km | 1.5× | Neighbouring countries |
| > 1,500 km | 1.0× | Rest of world |

### Sports Category Exception

For Sports news, the multiplier is **inverted** — international sports get priority over local sports:

| Distance | Multiplier |
|----------|------------|
| < 50 km | 0.4× (deprioritized) |
| < 500 km | 0.8× |
| < 2,000 km | 1.5× |
| > 2,000 km | 2.2× (highest) |

The location is extracted from article text during ingestion using NER (Named Entity Recognition) with a pre-defined gazetteer of known locations, and confidence scoring based on occurrence count and title mentions.

---

## 6. User Preference Learning (Interaction Service)

User preferences are **dynamically updated** as the user interacts with posts. The `InteractionService` handles three types of interactions:

### View (recording a post view)
- Adds **+0.2** to the post's category preference weight
- Adds **+0.15** to each tag preference weight

### Time Spent (how long the user engaged)
- A boost factor is calculated: `min(seconds / 30.0, 2.0)`
- Adds `boost × 0.3` to the category preference weight
- Adds `boost × 0.5` to each tag preference weight
- This means spending 60+ seconds on a post gives **2× boost**, while a quick glance gives proportionally less

### Click (clicking through to read the full article)
- Adds **+1.0** to the category preference weight (strong signal)
- Adds **+1.5** to each tag preference weight (strongest signal)

Over time, these accumulated weights form the user's preference profile (`UserPreference` table), which directly influences the **tag affinity** and **category affinity** components of the scoring formula.

---

## 7. Post-Reaction System

Users can **Like** or **Dislike** posts. These reactions affect:

1. **Popularity score** — likes increase it, dislikes decrease it (affects all users)
2. **User reaction state** — the frontend displays the user's own reaction (thumbs up/down)
3. **Preference learning** — (implicitly, as likes/clicks/view time correlate)

---

## 8. Deduplication

The frontend (`Feed.jsx`) deduplicates posts client-side to handle edge cases:

```javascript
setPosts((prev) => {
    const existingIds = new Set(prev.map((p) => p.id));
    const filtered = data.filter((p) => !existingIds.has(p.id));
    return [...prev, ...filtered];
});
```

This prevents duplicate posts from appearing when page boundaries shift (e.g., new posts are ingested between paginated requests).

---

## 9. Summary / Pseudocode

```
function getFeed(user, category, page, limit):
    // 1. Load user context
    preferences = loadTop20Preferences(user)
    seenPostIds = loadSeenPostIds(user)

    // 2. Fetch candidates (paginated, excluding seen)
    candidates = queryPosts(category, page, limit, exclude=seenPostIds)
    if candidates empty: return []

    // 3. Bulk load tags, reactions, user reactions
    tagsMap = loadTagsForPosts(candidates)
    likesMap, dislikesMap = countReactions(candidates)
    userReactions = loadUserReactions(user, candidates)

    // 4. Score each candidate
    scored = []
    for post in candidates:
        tagAffinity    = sum(preferences[tag] for tag in tagsMap[post])
        categoryAff    = preferences[post.category] ?? 0
        recency        = exp(-hoursSince(post.createdAt) / 48)
        popularity     = (likes + 1) / (likes + dislikes + 2)
        exploration    = random(0, 0.2)

        score = 0.45 * tagAffinity
              + 0.25 * categoryAff
              + 0.15 * recency
              + 0.10 * popularity
              + 0.05 * exploration

        // Location multiplier (from Python geo-extractor)
        if userHasLocation:
            geoMultiplier = calculateGeoMultiplier(user.lat, user.lon, post.locations, post.category)
            score *= geoMultiplier

        scored.add(post, score)

    // 5. Sort by score descending
    scored.sort(byScoreDescending)

    // 6. Map to DTO and return
    return scored.map(toDTO)
```

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Server-side ranking** | Prevents gaming the system, enables complex queries, reduces bandwidth |
| **Tag affinity as highest weight (45%)** | Maximizes personalization; tags are more granular than categories |
| **Seen post filtering** | Prevents stale, repetitive feeds |
| **Exploration factor (5%)** | Prevents filter bubbles, discovers new interests |
| **Geo multiplier (10× max)** | Strong local bias for location-relevant news |
| **Sports inversion** | Users typically want international sports highlights, not local games |
| **Implicit learning via interactions** | No explicit "tell us your interests" step needed — the system adapts naturally |
| **Additive smoothing on popularity** | Prevents new posts with few votes from having extreme scores |