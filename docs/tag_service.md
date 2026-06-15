# Tag Service

## 1. Service Identity

| Property | Value |
|----------|-------|
| **Path** | `backend/tag_service/` |
| **Port** | 8001 |
| **Framework** | FastAPI |
| **Entry point** | `backend/tag_service/app.py` |
| **GPU variant** | `backend/tag_service/appCUDA.py` |

The Tag Service extracts named entities and keywords from news text in English and Arabic. It exposes an HTTP API for on-demand extraction and supports a batch CLI mode for direct database processing.

---

## 2. API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |
| POST | `/extract-tags` | Extract tags from text |

### Request/Response

```json
// POST /extract-tags
{"text": "President Biden met with NATO leaders in Brussels.", "max_tags": 10}

// Response
{
  "tags": [
    {"tag": "Biden", "score": 0.95, "type": "entity"},
    {"tag": "NATO", "score": 0.92, "type": "entity"},
    {"tag": "Brussels", "score": 0.88, "type": "entity"},
    {"tag": "NATO leaders", "score": 0.72, "type": "keyword"}
  ]
}
```

---

## 3. Tagging Pipeline

### 3.1 Pipeline Stages

```
Input text
    │
    ▼
1. clean_text() — remove URLs, mentions, hashtags, normalize whitespace
    │
    ▼
2. detect_language() — langdetect → "en" or "ar"
    │
    ▼
3. normalize_arabic() — if Arabic, unify alef/yaa/taa marbuta variants
    │
    ▼
4. extract_entities() — BERT-NER pipeline
    │
    ▼
5. extract_keywords() — YAKE keyword extractor
    │
    ▼
6. merge_and_score() — deduplicate, assign confidence scores
    │
    ▼
Output: scored tag list
```

---

## 4. NLP Preprocessing

### 4.1 Text Cleaning

```python
def clean_text(text_str):
    text_str = text_str.replace("\n", " ").replace("\r", " ")
    text_str = re.sub(r"http\S+|@\w+|#", "", text_str)  # strip URLs, mentions
    return re.sub(r"\s+", " ", text_str).strip()
```

### 4.2 Language Detection

Uses `langdetect` library:
```python
def detect_language(text_str):
    return "ar" if detect(text_str).startswith("ar") else "en"
```

### 4.3 Arabic Normalization

```python
def normalize_arabic(text_str):
    # Unify alef variants: إأآا → ا
    # Normalize yaa, waw, taa marbuta
    # Remove diacritics (tashkeel)
    # Remove tatweel (kashida)
```

Critical for consistent NER and keyword matching across Arabic text variants.

### 4.4 Arabic Stopwords

```python
AR_STOPWORDS = {"في", "على", "من", "الى", "عن", "مع", "هذا", "ذلك", ...}
```

Filtered from keyword results.

---

## 5. Entity Extraction (ML-Based)

### 5.1 English NER

```python
ner_en = pipeline("ner", model="dslim/bert-base-NER", aggregation_strategy="simple")
```

- Model: `dslim/bert-base-NER`
- Labels: PER (person), ORG (organization), LOC (location), MISC
- Aggregation: merges subword tokens (`##` prefix stripped)

### 5.2 Arabic NER

```python
ner_ar = pipeline("ner", model="CAMeL-Lab/bert-base-arabic-camelbert-msa-ner", aggregation_strategy="simple")
```

- Model: CAMeL-Lab BERT Arabic MSA NER
- Handles Modern Standard Arabic entity recognition

### 5.3 Entity Scoring

Entities receive high confidence scores (~0.9+) reflecting NER model certainty.

---

## 6. Keyword Extraction (Rule-Based / Statistical)

### 6.1 YAKE Extractor

```python
kw_extractor_en = yake.KeywordExtractor(lan="en", n=2, top=10)
kw_extractor_ar = yake.KeywordExtractor(lan="ar", n=2, top=10)
```

- **YAKE** (Yet Another Keyword Extractor) — unsupervised statistical method
- `n=2` — max n-gram size of 2 words
- `top=10` — return top 10 keywords

### 6.2 Keyword Scoring

Keywords receive moderate scores (~0.5–0.9) based on YAKE relevance ranking.

---

## 7. Tag Merging and Scoring

```python
def merge_and_score(entities, keywords, max_tags):
    tags = []
    seen = set()
    
    # Entities first (higher priority)
    for entity in entities:
        if entity.lower() not in seen and len(entity) > 2:
            tags.append({"tag": entity, "score": 0.9, "type": "entity"})
            seen.add(entity.lower())
    
    # Keywords second
    for kw, score in keywords:
        if kw.lower() not in seen:
            tags.append({"tag": kw, "score": score, "type": "keyword"})
            seen.add(kw.lower())
    
    return tags[:max_tags]
```

---

## 8. Batch Database Mode

When run as CLI (`python app.py`):

```python
while True:
    posts = SELECT id, content FROM posts WHERE tags_extracted = 0 LIMIT 50
    for post in posts:
        tags = extract_tags(post.content)
        INSERT INTO posts_tags (post_id, tag, score)
        UPDATE posts SET tags_extracted = 1
    sleep(5)
```

**Note:** Table name `posts_tags` in tag_service vs `post_tags` in post_processor — potential schema inconsistency.

---

## 9. Integration Points

### 9.1 Spring Boot: ChannelTaggingService

**File:** `backend/src/main/java/.../service/ChannelTaggingService.java`

```java
POST tag.service.base-url/extract-tags
{"text": channelDescription}
```

Used during Telegram channel onboarding to extract tags from channel descriptions. Falls back to keyword extraction on service failure.

Config: `tag.service.base-url: http://localhost:8001`

### 9.2 Embedded: post_processor.py

The site crawler's embedded post processor duplicates tag extraction logic inline (same NER + YAKE models) writing directly to MySQL `post_tags` table every 10 seconds. This is the **primary production path** for post tagging.

### 9.3 Not Used For

- Post tagging in production (handled by post_processor)
- Real-time feed enrichment (batch/async only)

---

## 10. Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_USER` | news_user | Batch mode DB user |
| `DB_PASSWORD` | news_pass | Batch mode DB password |
| `DB_HOST` | localhost | Database host |
| `DB_PORT` | 3307 | Database port |
| `DB_NAME` | news_crawler_new | Database name (batch mode) |

---

## 11. GPU Variant

**File:** `backend/tag_service/appCUDA.py`

CUDA-optimized NER pipeline loading for GPU-accelerated inference. Same API contract as CPU variant.

---

## 12. Inputs and Outputs

### Inputs
| Input | Type | Description |
|-------|------|-------------|
| `text` | string | Raw news text (article body, channel description) |
| `max_tags` | int | Maximum tags to return (default 10) |

### Outputs
| Output | Type | Description |
|--------|------|-------------|
| `tags` | array | List of `{tag, score, type}` objects |
| `type` | enum | `"entity"` or `"keyword"` |

---

## 13. Rule-Based vs ML-Based Summary

| Component | Method | Models |
|-----------|--------|--------|
| Language detection | Statistical | langdetect |
| Arabic normalization | Rule-based | Regex transformations |
| Entity extraction | ML (supervised NER) | BERT-NER (EN), CAMeL-BERT (AR) |
| Keyword extraction | Statistical (unsupervised) | YAKE |
| Tag merging | Rule-based | Priority: entities > keywords |
| Stopword filtering | Rule-based | Static stopword lists |
