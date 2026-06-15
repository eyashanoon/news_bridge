# AI Vector Search (Legacy AI Service)

## 1. Service Identity

| Property | Value |
|----------|-------|
| **Path** | `backend/ai-service/` |
| **Port** | 9001 |
| **Framework** | FastAPI |
| **Entry point** | `backend/ai-service/main.py` |
| **Status** | Legacy — superseded by `ai-assistant-service` (port 9000) |

The legacy AI Service implements an earlier FAISS-based RAG architecture with tag-driven ingestion. The active News Feed frontend uses the AI Assistant service on port 9000 instead.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Application                       │
├─────────────────────────────────────────────────────────────┤
│  POST /ingest          Tag-driven bulk ingestion            │
│  POST /query           Vector search + LLM answer           │
│  POST /ingest/post/{id}  Single post ingestion             │
│  POST /summarize/post/{id}  Direct LLM summarization        │
├─────────────────────────────────────────────────────────────┤
│  APScheduler BackgroundScheduler                            │
│  └── Every 10 min: ingest tags ["Iran", "USA"]              │
├─────────────────────────────────────────────────────────────┤
│  Components:                                                │
│  ├── ingestion/embedder.py    Ollama embeddings             │
│  ├── ingestion/fetcher.py     Backend post fetcher          │
│  ├── ingestion/processor.py   Text chunking                   │
│  ├── retrieval/vector_store.py  FAISS storage                 │
│  ├── retrieval/search.py      Similarity search               │
│  ├── llm/generator.py         Answer generation               │
│  └── scheduler/jobs.py        Periodic ingestion              │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/ingest` | Ingest posts by tags (requires Authorization header) |
| POST | `/query` | Vector search + LLM answer |
| POST | `/ingest/post/{post_id}` | Manual single-post ingest |
| POST | `/summarize/post/{post_id}` | Direct Ollama summarization |

### 3.1 Query Request

```json
{
  "question": "What is the latest on Iran?",
  "tags": ["Iran"],
  "top_k": 5
}
```

### 3.2 Query Response

```json
{
  "answer": "Based on recent news...",
  "sources": [
    {"postId": 123, "text": "chunk...", "score": 0.87, "tag": "Iran"}
  ]
}
```

---

## 4. FAISS-Based Retrieval System

### 4.1 Vector Store

**File:** `retrieval/vector_store.py`

```python
class VectorStore:
    def __init__(self, dim):
        self.index = faiss.IndexFlatIP(dim)
        self.metadata = []  # parallel list
```

| File | Content |
|------|---------|
| `faiss.index` | FAISS IndexFlatIP binary |
| `faiss_meta.json` | Metadata with tag associations |

Unlike AI Assistant, metadata includes `tag` field for tag-based filtering.

### 4.2 Search

**File:** `retrieval/search.py`

```python
def retrieve_relevant_chunks(store, question, top_k=5):
    query_vec = embed_text(question)
    query_vec = normalize(query_vec)
    scores, indices = store.index.search(query_vec.reshape(1, -1), top_k)
    return [store.metadata[i] for i in indices[0] if i >= 0]
```

---

## 5. Ingestion Strategy

### 5.1 Tag-Driven Ingestion

**File:** `scheduler/jobs.py`

```python
def ingest_by_tags(store, tags):
    for tag in tags:
        posts = fetch_posts_by_tag(tag)  # GET /api/posts/by-tags
        for post in posts:
            content = fetch_post_content(post["id"])
            chunks = chunk_text(merge_paragraphs(content))
            for chunk in chunks:
                vec = embed_text(chunk)
                store.add(vec, {"postId": post["id"], "text": chunk, "tag": tag})
```

### 5.2 Scheduled Ingestion

On startup:

```python
scheduler.add_job(
    func=lambda: ingest_by_tags(store, ["Iran", "USA"]),
    trigger="interval",
    minutes=10
)
```

Hardcoded tag list — unlike AI Assistant's dynamic recent-post ingestion.

### 5.3 Single Post Ingestion

```python
@app.post("/ingest/post/{post_id}")
def ingest_post(post_id):
    content = fetch_post_content(post_id)
    chunks = chunk_text(merge_paragraphs(content))
    for chunk in chunks:
        vec = embed_text(chunk)
        store.add(vec, metadata)
```

### 5.4 Text Processing

**File:** `ingestion/processor.py`

```python
def merge_paragraphs(content_json):
    # Join text blocks from backend content response

def chunk_text(text, chunk_size=500, overlap=50):
    # Sliding window chunking (smaller chunks than AI Assistant)
```

---

## 6. Query Embedding Matching

```
1. embed_text(question) → query vector
2. L2-normalize query vector
3. FAISS IndexFlatIP.search(query_vec, top_k)
4. rerank(question, results) — keyword overlap boost
5. generate_answer(question, top chunks) via LLM
```

### 6.1 Keyword Reranking

**In main.py:**

```python
def rerank(question, results):
    q_words = set(question.lower().split())
    for r in results:
        text_words = set(r["text"].lower().split())
        overlap = len(q_words & text_words)
        r["rerank_score"] = r.get("score", 0) + overlap * 0.01
    return sorted(results, key=lambda x: x["rerank_score"], reverse=True)
```

Simple word overlap boost applied after vector similarity.

---

## 7. LLM Generation

**File:** `llm/generator.py`

```python
def generate_answer(question, context_chunks):
    context = "\n\n".join(c["text"] for c in context_chunks)
    prompt = f"Question: {question}\n\nContext:\n{context}\n\nAnswer:"
    return ollama_generate(prompt)
```

Direct Ollama `/api/generate` call without streaming.

---

## 8. Differences vs AI Assistant Service

| Aspect | AI Service (9001) | AI Assistant (9000) |
|--------|-------------------|---------------------|
| **Status** | Legacy | Primary/active |
| **Ingestion** | Tag-driven, hardcoded tags | Recent posts (24h), dynamic |
| **Scheduler** | APScheduler (sync), 10 min | AsyncIOScheduler, 15 min |
| **Query routing** | Single pipeline | Intent-based (summary/QA/topic) |
| **Post-specific Q&A** | Not supported | Direct backend fetch bypass |
| **News brief** | Not supported | Full scoring + LLM brief |
| **Translation** | Not supported | `/translate` endpoint |
| **Store clearing** | Persistent across queries | Cleared per topic query |
| **Backend client** | Sync requests | Async httpx |
| **Chunk size** | 500 chars, 50 overlap | 1000 chars, 200 overlap |
| **Tag extraction** | Manual tag parameter | LLM-extracted from question |
| **Fallback search** | Returns "not enough info" | Multi-stage fallback pipeline |
| **Frontend** | CORS for :5173 only | CORS open, used by :5174 |
| **Metadata** | Includes `tag` field | Includes `articleUrl`, `chunkIndex` |
| **Config prefix** | Direct env vars | `AI_ASSISTANT_` prefix |

---

## 9. Configuration

**File:** `backend/ai-service/config.py`

| Variable | Description |
|----------|-------------|
| `BACKEND_BASE_URL` | Spring Boot URL |
| `BACKEND_TOKEN` | JWT for backend API |
| `OLLAMA_URL` | Ollama API URL |
| `EMBEDDING_MODEL` | nomic-embed-text |
| `LLM_MODEL` | Generation model |
| `FAISS_INDEX_PATH` | faiss.index |
| `FAISS_META_PATH` | faiss_meta.json |

---

## 10. Backend Integration

**File:** `ingestion/fetcher.py`

```python
def fetch_posts_by_tag(tag):
    GET {BACKEND}/api/posts/by-tags?tags={tag}

def fetch_post_content(post_id):
    GET {BACKEND}/api/posts/{post_id}/content
```

Requires `Authorization` header with backend JWT token.

---

## 11. When to Use Which Service

| Use Case | Recommended Service |
|----------|-------------------|
| News Feed AI chat | AI Assistant (9000) |
| News brief panel | AI Assistant (9000) |
| Translation | AI Assistant (9000) |
| Legacy admin integration | AI Service (9001) |
| Tag-specific index building | AI Service (9001) |

---

## 12. Migration Path

The AI Assistant service was designed with backward compatibility:
- Accepts both `query` and `question` field names
- Supports `postId` parameter for post-specific queries
- News brief supports header-based auth (`X-User-Id`, `X-Language`)
- Same Ollama models and embedding dimensions

Legacy service retained for reference and potential admin tooling but is not started by default in Service Manager's core stack.

---

## 13. Inputs and Outputs

### /query
- **Input:** `{question, tags[], top_k}`
- **Output:** `{answer, sources[]}`

### /ingest
- **Input:** `{tags[]}` + Authorization header
- **Output:** `{status: "ok", message: "Ingestion completed"}`

### /summarize/post/{id}
- **Input:** Post ID
- **Output:** LLM-generated summary string
