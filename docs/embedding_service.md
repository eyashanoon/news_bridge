# Embedding Service

## 1. Overview

News Bridge does not deploy a standalone HTTP microservice named "embedding service." **Embedding generation is integrated** into the AI services via Ollama's embedding API. This document describes the complete embedding architecture across the platform.

---

## 2. Embedding Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Ollama (:11434)                           │
│  Model: nomic-embed-text                                    │
│  Output: 768-dimensional float vector                       │
├─────────────────────────────────────────────────────────────┤
│  Consumers:                                                  │
│  ├── ai-assistant-service/core/embedder.py    (primary)     │
│  └── ai-service/ingestion/embedder.py         (legacy)      │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  FAISS Vector Stores                                       │
│  ├── ai-assistant-service/data/faiss.index                  │
│  └── ai-service/faiss.index                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Primary Embedder (AI Assistant)

**File:** `backend/ai-assistant-service/core/embedder.py`

### 3.1 Class: Embedder

```python
class Embedder:
    def __init__(self):
        self.base_url = settings.ollama_base_url      # http://localhost:11434
        self.model = settings.embedder_model           # nomic-embed-text
        self.dim = settings.vector_dim                 # 768
```

### 3.2 Single Text Embedding

```python
def embed(self, text: str) -> np.ndarray:
    resp = httpx.post(
        f"{self.base_url}/api/embeddings",
        json={"model": self.model, "prompt": text},
        timeout=30,
    )
    vec = np.array(resp.json()["embedding"], dtype=np.float32)
    
    # L2-normalize so inner product == cosine similarity
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    return vec
```

### 3.3 Batch Embedding

```python
def embed_batch(self, texts: List[str]) -> np.ndarray:
    # Sequential calls (Ollama does not natively batch)
    vectors = [self.embed(t) for t in texts]
    return np.array(vectors, dtype=np.float32)
```

---

## 4. Legacy Embedder (AI Service)

**File:** `backend/ai-service/ingestion/embedder.py`

```python
def embed_text(text: str) -> list[float]:
    resp = requests.post(
        f"{OLLAMA_URL}/api/embeddings",
        json={"model": EMBEDDING_MODEL, "prompt": text},
    )
    return resp.json()["embedding"]
```

Same Ollama model, synchronous requests library instead of httpx.

---

## 5. Sentence Transformer Model

### 5.1 Model: nomic-embed-text

| Property | Value |
|----------|-------|
| Provider | Ollama (local runtime) |
| Architecture | Based on Nomic Embed (sentence transformer family) |
| Dimensions | 768 |
| Context length | ~8192 tokens |
| Normalization | L2-normalized by Embedder class |

### 5.2 Why Ollama Instead of Direct Sentence-Transformers

- Unified runtime with LLM (single Ollama process)
- No separate Python model loading/inference
- Consistent deployment via Service Manager
- Lower memory footprint (shared Ollama model cache)

Configuration in `ai-assistant-service/config.py`:

```python
embedder_model: str = "nomic-embed-text"
vector_dim: int = 768
ollama_base_url: str = "http://localhost:11434"
```

---

## 6. Embedding Generation Pipeline

### 6.1 Ingestion Path (AI Assistant)

**File:** `backend/ai-assistant-service/rag/ingest.py`

```
1. Fetch post content from backend (title + body)
2. Merge: "{title}\n\n{body}"
3. Chunk text (chunk_size=1000, overlap=200)
4. embed_batch(chunks) → (n, 768) normalized vectors
5. Build metadata: {postId, title, text, articleUrl, chunkIndex}
6. vector_store.add(vectors, metadata)
7. Persist to faiss.index + meta.json
```

### 6.2 Query Path

```
1. User submits question
2. embed(query) → (768,) normalized vector
3. FAISS IndexFlatIP search → top_k chunks by inner product
4. Chunks fed to LLM as context
```

### 6.3 Scheduled Refresh

**File:** `backend/ai-assistant-service/rag/scheduler.py`

Every 15 minutes (configurable):
```
1. Fetch posts created in last 24 hours
2. Skip already-ingested post IDs
3. ingest_post() for each new post
```

---

## 7. Vector Representation Logic

### 7.1 Normalization

All vectors L2-normalized before storage and query:

```
v_normalized = v / ||v||₂
```

### 7.2 Similarity Metric

FAISS `IndexFlatIP` (inner product) on normalized vectors:

```
similarity(query, document) = query · document = cos(θ)
```

Inner product equals cosine similarity when vectors are unit-length.

### 7.3 Chunk Metadata

Each vector stored with parallel metadata entry:

```json
{
  "postId": 1234,
  "title": "Article Headline",
  "text": "Chunk text content...",
  "articleUrl": "https://...",
  "chunkIndex": 0
}
```

---

## 8. Multilingual Support

### 8.1 Model Capabilities

`nomic-embed-text` supports multilingual embedding:
- English and Arabic news content embedded in same vector space
- No language-specific model switching required
- Cross-lingual retrieval possible (Arabic query → English document)

### 8.2 Platform Language Handling

- Tag service and classifier handle EN/AR separately
- Embeddings are language-agnostic (single model for all content)
- LLM prompts specify output language (English/Arabic) separately from embedding

---

## 9. Storage and Retrieval

### 9.1 AI Assistant Store

**File:** `backend/ai-assistant-service/rag/store.py`

| File | Content |
|------|---------|
| `data/faiss.index` | FAISS IndexFlatIP binary |
| `data/meta.json` | Parallel metadata JSON array |
| `data/ingested_posts.json` | Set of ingested post IDs |

Operations:
- `add(vectors, meta_list)` — append and persist
- `search(query_vector, top_k)` — inner product search
- `get_post_ids()` — dedup check during ingestion
- `clear()` — reset store

### 9.2 Legacy AI Service Store

**File:** `backend/ai-service/retrieval/vector_store.py`

| File | Content |
|------|---------|
| `faiss.index` | FAISS index binary |
| `faiss_meta.json` | Metadata with tag associations |

---

## 10. Configuration Reference

### AI Assistant (`config.py`)

| Setting | Env Variable | Default |
|---------|--------------|---------|
| Ollama URL | `AI_ASSISTANT_OLLAMA_BASE_URL` | `http://localhost:11434` |
| Embedder model | (in settings) | `nomic-embed-text` |
| Vector dimension | (in settings) | 768 |
| Chunk size | (in settings) | 1000 chars |
| Chunk overlap | (in settings) | 200 chars |
| Default top_k | (in settings) | 5 |
| Ingest interval | `AI_ASSISTANT_AUTO_INGEST_INTERVAL_MINUTES` | 15 |

### Legacy AI Service (`config.py`)

| Setting | Default |
|---------|---------|
| `OLLAMA_URL` | `http://localhost:11434` |
| `EMBEDDING_MODEL` | `nomic-embed-text` |
| `FAISS_INDEX_PATH` | `faiss.index` |
| `FAISS_META_PATH` | `faiss_meta.json` |

---

## 11. Performance Characteristics

| Aspect | Behavior |
|--------|----------|
| Batch embedding | Sequential (no native Ollama batching) |
| Typical latency | ~100-500ms per chunk via Ollama |
| Index type | IndexFlatIP (exact search, no approximation) |
| Scalability | Suitable for thousands of chunks; rebuild for larger scale |
| Persistence | Disk-backed; survives service restart |

---

## 12. Inputs and Outputs

### Inputs
| Input | Type | Description |
|-------|------|-------------|
| Text chunk | string | Article title+body chunk or user query |

### Outputs
| Output | Type | Description |
|--------|------|-------------|
| Embedding vector | float32[768] | L2-normalized dense vector |
| Search results | list[(score, metadata)] | Ranked chunks with similarity scores |
