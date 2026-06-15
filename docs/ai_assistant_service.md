# AI Assistant Service

## 1. Service Identity

| Property | Value |
|----------|-------|
| **Path** | `backend/ai-assistant-service/` |
| **Port** | 9000 |
| **Framework** | FastAPI (async lifespan) |
| **Entry point** | `backend/ai-assistant-service/main.py` |
| **Status** | Primary AI service (supersedes legacy ai-service) |

The AI Assistant Service is the platform's primary RAG (Retrieval-Augmented Generation) engine. It provides conversational Q&A, personalized news briefs, translation, and automated vector ingestion from the Spring Boot backend.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    FastAPI Application                           │
│  Lifespan: init LLM, Embedder, VectorStore, services, scheduler │
├─────────────────────────────────────────────────────────────────┤
│  API Layer                                                       │
│  ├── POST /query          → QueryService                        │
│  ├── POST /news-brief     → NewsBriefService                    │
│  ├── POST /translate      → TranslateService                    │
│  ├── POST /ingest/post/{id} → Ingester                          │
│  └── GET  /health                                               │
├─────────────────────────────────────────────────────────────────┤
│  Logic Layer (logic/)                                           │
│  ├── query_service.py     Multi-stage RAG pipeline              │
│  ├── router.py            Intent classification heuristics       │
│  ├── news_brief_service.py  Personalized brief scoring          │
│  ├── translate_service.py Translation via LLM                   │
│  └── backend_client.py    Async httpx → Spring Boot             │
├─────────────────────────────────────────────────────────────────┤
│  Core Layer (core/)                                             │
│  ├── llm.py               Ollama chat API wrapper               │
│  └── embedder.py          Ollama embedding API wrapper          │
├─────────────────────────────────────────────────────────────────┤
│  RAG Layer (rag/)                                               │
│  ├── store.py             FAISS IndexFlatIP + disk persistence  │
│  ├── ingest.py            Chunk, embed, store pipeline          │
│  └── scheduler.py         Auto-ingest recent posts              │
└─────────────────────────────────────────────────────────────────┘
         │                    │
         ▼                    ▼
   Spring Boot :8080     Ollama :11434
   (posts, preferences)  (LLM + embeddings)
```

---

## 3. API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Vector count, LLM availability |
| POST | `/query` | Conversational Q&A |
| POST | `/news-brief` | Personalized AI news brief |
| POST | `/translate` | Text translation |
| POST | `/ingest/post/{post_id}` | On-demand vector ingestion |

### 3.1 Query Request

```json
{
  "query": "What's happening in Gaza?",
  "question": "...",       // alias for query (backward compat)
  "postId": 1234,          // optional: specific post context
  "tags": ["Israel"],      // optional: tag filter
  "top_k": 5
}
```

### 3.2 News Brief Request

```json
// Body (optional)
{"userId": "42", "language": "english", "maxPosts": 12}

// Or via headers
X-User-Id: 42
X-Language: arabic
```

---

## 4. RAG Pipeline Architecture

### 4.1 Vector Store

**File:** `rag/store.py`

- **Index type:** FAISS `IndexFlatIP` (exact inner product search)
- **Dimension:** 768 (nomic-embed-text)
- **Persistence:** `data/faiss.index` + `data/meta.json`
- **Deduplication:** `data/ingested_posts.json` tracks ingested post IDs

### 4.2 Ingestion Pipeline

**File:** `rag/ingest.py`

```
Post ID
    │
    ▼
backend.get_post_content(post_id) → {title, content}
    │
    ▼
Merge: "{title}\n\n{content}"
    │
    ▼
_chunk_text() — sliding window
  chunk_size=1000, overlap=200
    │
    ▼
embedder.embed_batch(chunks) → (n, 768) normalized
    │
    ▼
Build metadata per chunk:
  {postId, title, text, articleUrl, chunkIndex}
    │
    ▼
vector_store.add(vectors, metadata)
    │
    ▼
Persist to disk
```

### 4.3 Auto-Ingestion Scheduler

**File:** `rag/scheduler.py`

```python
class IngestionScheduler:
    async def start():
        # Run immediately on startup
        await self._ingest_recent()
        # Schedule periodic runs
        scheduler.add_job(self._ingest_recent, 'interval',
                         minutes=settings.auto_ingest_interval_minutes)
```

Default: every 15 minutes, ingests posts from last 24 hours.

---

## 5. Query Routing Logic

**File:** `logic/router.py`

### 5.1 Intent Classification

```python
class QueryIntent(Enum):
    POST_SUMMARY = "post_summary"
    POST_QA = "post_qa"
    TOPIC_SEARCH = "topic_search"
```

### 5.2 Heuristic Rules

| Intent | Trigger Phrases |
|--------|----------------|
| POST_SUMMARY | "summarize", "summary", "tl;dr", "give me a summary" |
| POST_QA | "about this article", "explain this", "tell me about this" |
| TOPIC_SEARCH | Default (all other queries) |

Post ID extraction: scans query for numeric tokens ≥3 digits.

**Note:** Designed for future LLM-based routing enhancement.

### 5.3 Routing Decision Tree

```
query + optional postId
    │
    ├── postId provided? → _handle_post_query (direct backend fetch)
    │
    ├── POST_SUMMARY intent? → _handle_post_query
    │
    ├── POST_QA intent? → _handle_post_query
    │
    └── Default → _handle_topic_search (full RAG pipeline)
```

---

## 6. Query Pipelines in Detail

### 6.1 Post-Specific Queries (Summary / Q&A)

**Bypasses RAG entirely** — fetches full content from backend:

```
1. GET /api/posts/{id}/content from backend
2. Merge title + body as full context
3. Build prompt based on intent:
   - SUMMARY: "Summarize the following article..."
   - QA: "Answer the question based on article content..."
4. llm.generate(prompt) → response
```

### 6.2 Topic Search (Full RAG)

**File:** `logic/query_service.py` — `_handle_topic_search()`

```
Step 0: Clear vector store (fresh retrieval per query)
Step 1: Extract tags from question via LLM
Step 2: Fetch candidate posts by tags from backend
        Fallback: fetch by category if tags empty
Step 3: If no candidates → _fallback_search (broader vector search)
Step 4: Ingest candidate posts into vector store
Step 5: Embed query → FAISS search → top_k chunks
Step 6: Filter results to candidate post IDs only
Step 7: Format context → LLM generate answer
Step 8: Append source references (titles + URLs)
```

### 6.3 Tag Extraction Prompt

```python
TAG_EXTRACT_PROMPT = (
    "Extract 2-5 short, individual keywords or proper nouns from the following news question. "
    "Each tag should be a single word or a short proper noun (2 words max). "
    "Do NOT use compound phrases or multi-word descriptions. "
    "Return only the tags as a comma-separated list, nothing else.\n\n"
    "Question: {query}"
)
```

Example: "What's happening between Israel and Iran?" → `Israel, Iran`

### 6.4 Fallback Search

When tag-based retrieval fails:

```
1. Search existing vector store with query embedding
2. If store empty: fetch recent posts from backend, ingest, re-search
3. Generate answer from best available context
```

---

## 7. Ollama LLM Integration

**File:** `core/llm.py`

### 7.1 Configuration

```python
ollama_base_url = "http://localhost:11434"
llm_model = settings.llm_model  # e.g., "llama3"
```

### 7.2 Generation

```python
def generate(self, prompt: str, temperature: float = None) -> str:
    resp = httpx.post(
        f"{self.base_url}/api/generate",
        json={
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": temperature or settings.llm_temperature}
        },
        timeout=120,
    )
    return resp.json()["response"]
```

### 7.3 Availability Check

```python
def is_available(self) -> bool:
    try:
        httpx.get(f"{self.base_url}/api/tags", timeout=5)
        return True
    except:
        return False
```

Used by NewsBriefService for graceful LLM-unavailable fallback.

---

## 8. Prompt Engineering

### 8.1 Topic Search Answer Prompt

```
Answer the following question based on the provided news context.

Question: {query}

News context:
{formatted_chunks}

Provide a concise, informative answer in the same language as the question.
```

### 8.2 Summary Prompt

```
Summarize the following article content concisely.

Article content:
{full_text}

Provide a brief summary highlighting the key points.
```

### 8.3 News Brief Prompt

```
Generate a concise news brief with bold headlines and short summaries.
Here are the top stories:
- {headline_1}
- {headline_2}
...

Write the brief in {language}.
Format: **Headline** followed by a 1-2 sentence summary.
```

### 8.4 Context Formatting

```python
def _format_context(self, results):
    parts = []
    for score, meta in results:
        parts.append(f"[{meta['title']}]\n{meta['text']}")
    return "\n\n---\n\n".join(parts)
```

---

## 9. News Brief Service

**File:** `logic/news_brief_service.py`

See `recommendation_worker.md` for scoring formula details.

Pipeline:
1. Fetch user preferences (tag/category weights)
2. Fetch posts ≤12 hours old
3. Score: 40% preference + 35% recency + 25% importance
4. Select top 5–12 posts
5. LLM generates narrative brief (or headline fallback)

---

## 10. Backend Client

**File:** `logic/backend_client.py`

Async httpx client to Spring Boot:

| Method | Backend Endpoint |
|--------|-----------------|
| `get_post_content(id)` | `GET /api/posts/{id}/content` |
| `get_post_by_id(id)` | `GET /api/posts/{id}` (metadata) |
| `fetch_posts_by_tags(tags)` | `GET /api/posts/by-tags` |
| `get_recent_posts(hours)` | Feed/recent posts endpoint |
| `get_user_preferences(user_id)` | `GET /api/users/{id}/preferences` |

Authentication via `AI_ASSISTANT_BACKEND_TOKEN` env var.

---

## 11. Response Generation Pipeline

```
User query (frontend ChatWidget)
    │
    ▼
POST /ai/query (Vite proxy → :9000)
    │
    ▼
classify_query() → intent
    │
    ├── Post-specific → backend fetch → LLM prompt → answer
    │
    └── Topic search → tag extract → backend fetch → ingest →
        FAISS search → context format → LLM generate →
        append references → JSON response
    │
    ▼
Frontend displays answer in ChatWidget
```

---

## 12. Configuration

**File:** `config.py` (Pydantic Settings, prefix `AI_ASSISTANT_`)

| Setting | Default | Description |
|---------|---------|-------------|
| `host` | 0.0.0.0 | Bind address |
| `port` | 9000 | Service port |
| `ollama_base_url` | http://localhost:11434 | Ollama API |
| `llm_model` | llama3 | Generation model |
| `embedder_model` | nomic-embed-text | Embedding model |
| `vector_dim` | 768 | Embedding dimensions |
| `chunk_size` | 1000 | Ingestion chunk size |
| `chunk_overlap` | 200 | Chunk overlap |
| `default_top_k` | 5 | Search results |
| `fallback_top_k` | 15 | Broader search |
| `auto_ingest_interval_minutes` | 15 | Scheduler interval |
| `llm_temperature` | 0.7 | Default generation temperature |
| `llm_temperature_brief` | 0.5 | Brief generation temperature |

---

## 13. Frontend Integration

**Web:** `news-feed/src/utils/aiFetch.js` → Vite proxy `/ai` → `:9000`

**Components:**
- `ChatWidget.jsx` — `POST /query` with `{query, postId}`
- `NewsBrief.jsx` — `POST /news-brief` with user/language headers

**Mobile:** Direct HTTP to `{host}:9000` in `AIAssistantPage.jsx`

---

## 14. Persisted State

| File | Purpose |
|------|---------|
| `data/faiss.index` | FAISS vector index |
| `data/meta.json` | Chunk metadata array |
| `data/ingested_posts.json` | Ingested post ID tracking |

---

## 15. Inputs and Outputs

### /query
- **Input:** Natural language question, optional postId/tags
- **Output:** `{answer: string, sources?: [...]}`

### /news-brief
- **Input:** userId, language preference
- **Output:** `{posts: [...], brief_text: string, average_score: float}`

### /translate
- **Input:** `{text, targetLanguage}`
- **Output:** `{translatedText: string}`

### /ingest/post/{id}
- **Input:** Post ID path parameter
- **Output:** `{status: "ok"|"empty"|"error"}`
