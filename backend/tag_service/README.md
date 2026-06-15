# Tag Extraction Service

## 1. Introduction

The **Tag Extraction Service** is responsible for automatically generating descriptive tags for news articles ingested into the platform. It processes both **Arabic** and **English** content through a multi-stage NLP pipeline that combines Named Entity Recognition (NER) with keyword extraction, then scores and ranks the results to produce high-quality, relevant tags.

Tags serve multiple purposes across the platform:
- **Content discovery** — users can search and browse posts by tags
- **Personalised feed scoring** — user preferences on tags influence feed ranking
- **Topic clustering** — related posts are grouped by shared tags
- **RAG context retrieval** — the AI assistant retrieves posts by tag relevance

---

## 2. Model Selection

The tag extraction pipeline uses three distinct NLP models operating in sequence:

### 2.1 Named Entity Recognition — English

| Property          | Value                        |
|-------------------|------------------------------|
| **Model**         | `dslim/bert-base-NER`        |
| **Architecture**  | BERT-base fine-tuned on CoNLL-2003 |
| **Entities**      | PER (person), ORG (organisation), LOC (location), MISC (miscellaneous) |
| **Aggregation**   | `simple` — merges subword tokens into full words |

This model is a compact BERT-based NER model optimised for inference speed while maintaining strong accuracy on standard entity types.

### 2.2 Named Entity Recognition — Arabic

| Property          | Value                                    |
|-------------------|------------------------------------------|
| **Model**         | `CAMeL-Lab/bert-base-arabic-camelbert-msa-ner` |
| **Architecture**  | CAMeL-BERT (Arabic BERT) on Wojood NER corpus |
| **Entities**      | Multi-class NER including persons, locations, organisations |
| **Aggregation**   | `simple`                                 |

This model is specifically trained on Modern Standard Arabic, making it suitable for news content from Arab sources.

### 2.3 Keyword Extraction — YAKE

| Property          | Value                        |
|-------------------|------------------------------|
| **Library**       | `yake` (Yet Another Keyword Extractor) |
| **Language**      | English (`lan="en"`) / Arabic (`lan="ar"`) |
| **N-gram range**  | 1–2 words (`n=2`) |
| **Top results**   | 10 keywords (`top=10`) |

YAKE is an unsupervised, language-agnostic keyword extraction algorithm that does not require training data. It ranks keywords by statistical features such as:
- Word frequency
- Word co-occurrence with surrounding words
- Word position in the text
- Word casing (for English)
- Punctuation association

YAKE outputs an inverse score (lower = better), which the pipeline converts by computing `1 - score` so higher values represent stronger keywords.

---

## 3. Software Architecture

The tag extraction pipeline exists in **two versions** and is also **embedded within the post-processor**.

### 3.1 File Structure

```
backend/tag_service/
├── app.py            # Dual-purpose: CLI batch + FastAPI service (CPU)
├── appCUDA.py        # FastAPI service with GPU acceleration
├── test.py           # Standalone test/batch script
├── requirements.txt  # Python dependencies
├── tree.txt          # Directory tree reference
└── README.md         # This documentation
```

### 3.2 Version Matrix

| File       | Mode                      | Device   | Model Loading           |
|------------|---------------------------|----------|-------------------------|
| `app.py`   | CLI batch + FastAPI       | CPU      | Lazy singleton + startup event |
| `appCUDA.py` | FastAPI only              | GPU / CPU | Application lifespan event |
| `test.py`  | CLI batch only            | GPU / CPU | Immediate on start      |

---

## 4. Data Preprocessing Pipeline

Before any NLP models are applied, incoming text undergoes a standard preprocessing pipeline.

### 4.1 Text Cleaning

```python
def clean_text(text: str) -> str:
    text = text.replace("\n", " ").replace("\r", " ")  # Normalise line breaks
    text = re.sub(r"http\S+|@\w+|#", "", text)          # Remove URLs, mentions, hashtags
    return re.sub(r"\s+", " ", text).strip()             # Collapse whitespace
```

### 4.2 Language Detection

Language detection is performed using `langdetect` (a Python port of Google's language-detection library):

```python
def detect_language(text: str) -> str:
    try:
        return "ar" if detect(text).startswith("ar") else "en"
    except:
        return "en"  # Default to English on failure
```

### 4.3 Arabic Text Normalisation

For Arabic content, Unicode normalisation is applied to reduce orthographic variation:

| Transformation | Example |
|----------------|---------|
| Normalise alef forms | إ أ آ ا → ا |
| Normalise yaa | ى → ي |
| Normalise waw with hamza | ؤ → و |
| Normalise yaa with hamza | ئ → ي |
| Normalise taa marbouta | ة → ه |
| Remove diacritics | Fatha, damma, kasra, shadda, sukoon |
| Remove tatweel/kashida | ـ |

```python
def normalize_arabic(text: str) -> str:
    text = re.sub("[إأآا]", "ا", text)
    text = re.sub("ى", "ي", text)
    text = re.sub("ؤ", "و", text)
    text = re.sub("ئ", "ي", text)
    text = re.sub("ة", "ه", text)
    text = re.sub(r"[\u0617-\u061A\u064B-\u0652]", "", text)  # Diacritics
    return re.sub(r"ـ", "", text)  # Tatweel
```

---

## 5. Tag Generation Pipeline

The complete pipeline processes text through four stages.

### 5.1 Processing Flow

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Raw Text   │───→│   Clean &    │───→│  Language    │───→│  Arabic      │
│              │    │  Normalise   │    │  Detection   │    │ Normalisation│
└──────────────┘    └──────────────┘    └──────────────┘    └──────┬───────┘
                                                                   │
                    ┌───────────────────────────────────────────────┘
                    │
                    ▼
         ┌─────────────────────┐
         │   NER Pipeline      │
         │  (BERT / CAMeL-BERT)│
         └──────────┬──────────┘
                    │ Entities
         ┌──────────▼──────────┐
         │  YAKE Keyword       │
         │  Extraction         │
         └──────────┬──────────┘
                    │ Keywords + scores
         ┌──────────▼──────────┐
         │  Tag Scoring &      │
         │  Deduplication      │
         └──────────┬──────────┘
                    │ Sorted tags
         ┌──────────▼──────────┐
         │  Top-K (max 10)     │
         └─────────────────────┘
```

### 5.2 Entity Extraction (NER)

```python
def extract_entities(text: str, lang: str):
    ner_pipe = ner_ar if lang == "ar" else ner_en
    entities = []

    try:
        results = ner_pipe(text)  # Returns list of dicts with 'word', 'entity_group', 'score'
        current = ""
        for r in results:
            word = r.get("word", "").replace("##", "")  # Merge subword tokens
            if r.get("word", "").startswith("##"):
                current += word  # Continuation of a token
            else:
                if current:
                    entities.append(current.strip())
                current = word
        if current:
            entities.append(current.strip())
    except Exception as e:
        print("NER error:", e)

    return entities  # e.g. ["Joe Biden", "United States", "Microsoft"]
```

The NER pipeline returns entity spans detected by the model. Subword tokens (prefixed with `##`) are merged back into complete words. Entities with fewer than 3 characters are filtered out later in the scoring stage.

### 5.3 Keyword Extraction (YAKE)

```python
def extract_keywords(text: str, lang: str):
    extractor = kw_extractor_ar if lang == "ar" else kw_extractor_en
    keywords = []

    try:
        results = extractor.extract_keywords(text)  # Returns [(keyword, inverse_score), ...]
        for kw, score in results:
            kw = kw.strip()
            score = 1 - score  # Invert: higher = more important
            keywords.append((kw, score))
    except Exception as e:
        print("YAKE error:", e)

    return keywords  # e.g. [("artificial intelligence", 0.87), ("processor", 0.72)]
```

YAKE scores are inverted because YAKE outputs lower scores for more relevant keywords. The inverted score `1 - raw_score` makes higher values represent stronger keyword candidates.

### 5.4 Tag Scoring & Ranking

The scoring algorithm combines entities and keywords into a unified ranked list.

#### Entity Scoring (High Priority)

| Criteria           | Score Component      |
|--------------------|----------------------|
| Base score         | `0.9`                |
| Frequency bonus    | `min(freq × 0.05, 0.1)` |
| Minimum length     | 3 characters         |

```python
for e in entities:
    key = e.lower()
    if len(e) < 3:
        continue
    score = 0.9 + min(text_lower.count(key) * 0.05, 0.1)
    tag_scores[key] = {"tag": e, "score": round(score, 3), "type": "entity"}
```

Entities start at a high base score (0.9) because named entities are typically the most informative descriptors. The frequency bonus (up to +0.1) rewards entities mentioned multiple times.

#### Keyword Scoring (Medium Priority)

| Criteria           | Score Component      |
|--------------------|----------------------|
| Base score         | `0.5`                |
| YAKE contribution  | `base_score × 0.4`   |
| Maximum score      | `0.9` (when YAKE=1.0) |
| Minimum length     | 3 characters         |

```python
for kw, base_score in keywords:
    key = kw.lower()
    if key in tag_scores or (lang == "ar" and kw in AR_STOPWORDS) or len(kw) < 3:
        continue
    score = 0.5 + base_score * 0.4
    tag_scores[key] = {"tag": kw, "score": round(score, 3), "type": "keyword"}
```

Keywords start lower (0.5) and are boosted by the YAKE confidence. The deduplication check `if key in tag_scores` prevents overwriting a higher-confidence entity tag with a keyword match.

#### Arabic Stopword Filtering

Common Arabic stopwords are excluded from keyword tags:

```python
AR_STOPWORDS = {
    "في", "على", "من", "الى", "عن", "مع", "هذا", "ذلك",
    "علي", "فيه", "كما", "تم", "بعد", "قبل"
}
```

### 5.5 Final Output

Tags are sorted by score in descending order and capped at a maximum of 10:

```python
tag_scores = sorted(tag_scores.values(), key=lambda x: x["score"], reverse=True)[:10]
```

Each tag has the structure:

```json
{
  "tag": "artificial intelligence",
  "score": 0.923,
  "type": "entity"
}
```

---

## 6. Deployment & Integration

### 6.1 FastAPI Service (REST API)

Two deployment variants are available:

#### CPU Variant (`app.py`)

```bash
uvicorn tag_service.app:app --host 0.0.0.0 --port 8001
```

Models are loaded lazily via the FastAPI startup event handler (`@app.on_event("startup")`).

#### GPU Variant (`appCUDA.py`)

```bash
uvicorn tag_service.appCUDA:app --host 0.0.0.0 --port 8001
```

Uses the newer FastAPI lifespan pattern for model loading on GPU (CUDA device 0) with automatic CPU fallback.

#### API Endpoint

**`POST /extract-tags`**

Request:
```json
{
  "text": "Apple Inc. announced a new artificial intelligence chip for data centres, boosting performance by 40%.",
  "max_tags": 10
}
```

Response:
```json
{
  "language": "en",
  "tags": [
    {"tag": "Apple Inc.", "score": 0.95, "type": "entity"},
    {"tag": "artificial intelligence", "score": 0.87, "type": "keyword"},
    {"tag": "data centres", "score": 0.82, "type": "keyword"}
  ],
  "entities_found": 3,
  "keywords_found": 7
}
```

**`GET /`**

```json
{
  "status": "Advanced Tag Service Running"
}
```

### 6.2 Batch Database Processing

Both `app.py` (CLI mode) and `test.py` support direct database integration:

```bash
python backend/tag_service/app.py     # Processes all posts WHERE tags_extracted = 0
python backend/tag_service/test.py    # Alternative version, different DB config
```

#### Database Schema

```sql
CREATE TABLE IF NOT EXISTS posts_tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    tag VARCHAR(255),
    score FLOAT,
    tag_type VARCHAR(50),       -- 'entity' or 'keyword'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

The batch processor:
1. Queries `posts` table for rows where `tags_extracted = 0`
2. Runs the full extraction pipeline on `posts.text`
3. Inserts the scored tags into `posts_tags`
4. Updates `posts.tags_extracted = 1` and `posts.extracted_at = NOW()`

### 6.3 Embedded Post-Processor (`post_processor.py`)

Tag extraction logic is also embedded directly in the `backend/post_processor.py` script, which runs **after** the category classification step. This provides a unified processing pipeline:

```python
# Inside process_pending_posts() (post_processor.py)
# Step 1: Classify → update label
label = _predict_label(text_clean)
conn.execute(text("UPDATE posts SET label = :label ..."))

# Step 2: Tag extraction
entities = _extract_entities(text_clean, lang)
keywords = _extract_keywords(text_clean, lang)
scored_tags = _score_tags(text_clean, entities, keywords, lang)

# Step 3: Persist tags
for tag_result in scored_tags:
    conn.execute(text("INSERT IGNORE INTO post_tags (post_id, tag) VALUES (:post_id, :tag)"))
```

---

## 7. Backend Integration (Java/Spring)

The Java backend consumes the extracted tags through several services.

### 7.1 Entity Model

```java
@Entity
@Table(name = "PostTags",
        uniqueConstraints = @UniqueConstraint(columnNames = {"post_id", "tag"}))
public class PostTag {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    private Post post;

    @Column(nullable = false)
    private String tag;
}
```

### 7.2 Repository

```java
public interface PostTagRepository extends JpaRepository<PostTag, Long> {
    List<PostTag> findByPostId(Long postId);
    List<PostTag> findByPostIdIn(List<Long> postIds);
    List<PostTag> findByTagIn(List<String> tags);
}
```

### 7.3 API Endpoints

| Method | Path                      | Description                          |
|--------|---------------------------|--------------------------------------|
| GET    | `/api/posts/by-tags`      | Find posts matching a list of tags   |
| GET    | `/api/posts/by-tags/recent` | Recent posts by tags (AI assistant) |

### 7.4 Tag Usage in Feed Scoring

Tags play a critical role in the personalised feed algorithm (`FeedService.java`):

```java
// For each post, compute tag affinity based on user preferences
for (String tag : tags) {
    tagAffinity += prefMap.getOrDefault(tag.toLowerCase(), 0.0);
}

// Final feed score
double score = 0.45 * tagAffinity
             + 0.25 * categoryAffinity
             + 0.20 * recencyScore
             + 0.10 * popularityScore;
```

Tag affinity accounts for **45%** of the feed ranking score, making it the single most important factor in personalisation.

### 7.5 User Preference Learning

User preferences are updated based on interaction signals:

| Interaction          | Weight Change  | Scope         |
|----------------------|----------------|---------------|
| Like / Save          | `+1.5`         | All post tags |
| Share                | `+1.2`         | All post tags |
| View                 | `+0.15`        | All post tags |
| Dislike / Remove     | `-0.15`        | All post tags |
| Hide                 | `-0.9`         | All post tags |

```java
// In InteractionService.java
List<PostTag> tags = postTagRepository.findByPostId(postId);
for (PostTag t : tags) {
    updateUserPreference(AppUser, t.getTag(), 1.5);  // +1.5 for likes
}
```

These preferences persist in the `UserPreferences` table with a `(user_id, tag)` unique constraint, enabling efficient upsert operations.

---

## 8. Dependencies

```
fastapi              # Web framework for REST API
uvicorn              # ASGI server
langdetect           # Language detection (Arabic vs English)
keybert              # Alternative keyword extraction (included for future use)
sentence-transformers # Sentence embeddings (included for future use)
transformers         # HuggingFace BERT / CAMeL-BERT models
torch                # PyTorch backend for transformer models
regex                # Text cleaning and Arabic normalisation
yake                 # Unsupervised keyword extraction
pymysql              # MySQL database connectivity (batch mode only)
sqlalchemy           # ORM for database operations (batch mode only)
```

---

## 9. System Architecture Overview

```
                        ┌──────────────────────────────┐
                        │    FastAPI Tag Service        │
                        │  (app.py / appCUDA.py)        │
                        │  POST /extract-tags           │
                        └──────────┬───────────────────┘
                                   │ REST API
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
   ┌──────────▼──────────┐  ┌─────▼──────┐  ┌─────────▼──────────┐
   │  post_processor.py  │  │ External   │  │  Frontend /        │
   │  (database batch)   │  │ Consumers  │  │  Admin Tools       │
   └──────────┬──────────┘  └────────────┘  └────────────────────┘
              │
    ┌─────────▼─────────┐
    │   MySQL Database  │
    │                   │
    │  ┌─────────────┐  │
    │  │ posts_tags  │  │  ← Raw tag strings + scores
    │  └─────────────┘  │
    │  ┌─────────────┐  │
    │  │ PostTags    │  │  ← JPA entity (Post → tag mapping)
    │  └─────────────┘  │
    │  ┌─────────────┐  │
    │  │UserPrefs    │  │  ← Per-user tag weights
    │  └─────────────┘  │
    └───────────────────┘
              │
              ▼
    ┌─────────────────────┐
    │   FeedService       │  ← 45% tag affinity in ranking
    │   SearchService     │  ← by-tags search endpoints
    │   AI Assistant      │  ← RAG context via post tags
    └─────────────────────┘
```

---

## 10. Conclusion

The Tag Extraction Service combines **supervised NER** (BERT / CAMeL-BERT) with **unsupervised keyword extraction** (YAKE) to produce high-quality, ranked tags for multilingual news content. The service is deployed through three parallel paths:

1. **REST API** — Real-time tag extraction via FastAPI (CPU or GPU)
2. **Batch database processor** — Scheduled processing of unprocessed posts
3. **Embedded post-processor** — Integrated within the unified classification + tagging pipeline

The generated tags are deeply integrated into the platform's personalisation engine, where they contribute **45% of the feed ranking weight** and power search, topic clustering, and AI assistant context retrieval.