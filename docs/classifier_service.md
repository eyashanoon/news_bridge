# Classifier Service

## 1. Service Identity

| Property | Value |
|----------|-------|
| **Path** | `backend/classifier_service/` |
| **Port** | 8002 |
| **Framework** | FastAPI |
| **Entry point** | `backend/classifier_service/news_classifier_app.py` |
| **Model checkpoint** | `backend/classifier_service/final_mode_V2/` |

The Classifier Service assigns **news category labels** to article text using a fine-tuned HuggingFace transformer model. It serves both as a standalone HTTP API and as an embedded component within the site crawler's post-processing pipeline.

---

## 2. API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |
| GET | `/health` | Service status |
| POST | `/predict` | Classify text → category + confidence |

### Request/Response

```json
// POST /predict
{"text": "The Senate passed a new climate bill today..."}

// Response
{
  "text": "The Senate passed a new climate bill today...",
  "category": "Politics",
  "confidence": 0.87
}
```

---

## 3. Classification Model

### 3.1 Architecture

```python
tokenizer = AutoTokenizer.from_pretrained("./final_mode_V2")
model = AutoModelForSequenceClassification.from_pretrained("./final_mode_V2")
```

- **Type:** Sequence classification (single-label)
- **Framework:** HuggingFace Transformers + PyTorch
- **Device:** CPU (explicitly set; thread count limited to 1)
- **Max sequence length:** 128 tokens

### 3.2 Category Labels

Defined in model config `id2label` mapping. Categories align with News Bridge taxonomy seeded in `DataInitializer.java`:

| Category | Description |
|----------|-------------|
| Politics | Government, elections, policy |
| Sports | Athletic events, teams |
| Technology | Tech industry, AI, gadgets |
| Business | Economy, markets, companies |
| Health | Medical, wellness |
| Entertainment | Movies, music, celebrities |
| Science | Research, discoveries |
| World | International news |
| General | Uncategorized/default |

Exact label set loaded from `model.config.id2label` at runtime.

---

## 4. Inference Pipeline

### 4.1 Prediction Function

```python
def predict(text: str):
    inputs = tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding="max_length",
        max_length=128
    ).to(device)

    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits
        probs = F.softmax(logits, dim=1)
        pred_id = torch.argmax(probs, dim=1).item()
        confidence = probs[0, pred_id].item()

    label = model.config.id2label[pred_id]
    return label, confidence
```

### 4.2 Preprocessing

- Text truncated to 128 tokens
- Padding to max_length for batch consistency
- No explicit text cleaning (relies on upstream post_processor cleaning)

---

## 5. Feature Extraction

The transformer model performs **implicit feature extraction** via self-attention over token embeddings. No hand-crafted features are used in the HTTP service path.

For the legacy URL classifier (`checker/url_model`), hand-crafted features exist but are **not used** in the active pipeline.

---

## 6. Model Decision Logic

```
1. Tokenize input text
2. Forward pass through fine-tuned BERT/RoBERTa classifier
3. Softmax over category logits
4. Select argmax category
5. Return (label, confidence)
```

No confidence threshold filtering at service level — all predictions returned regardless of confidence. Downstream systems may apply thresholds.

---

## 7. Embedded Usage in Crawler Pipeline

**File:** `backend/post_processor.py`

The primary production classification path runs **inside the site crawler process**:

```python
CLASSIFIER_MODEL_PATH = "backend/classifier_service/final_mode_V2"

def classify_post(text):
    inputs = _classifier_tokenizer(text, return_tensors="pt", truncation=True, max_length=128)
    with torch.no_grad():
        outputs = _classifier_model(**inputs)
        probs = F.softmax(outputs.logits, dim=1)
        pred_id = torch.argmax(probs, dim=1).item()
    return model.config.id2label[pred_id]
```

Triggered every 10 seconds by APScheduler in `crawler_server/main.py`:

```python
UPDATE posts SET label = ?, lang = ?, tags_extracted = 1 WHERE id = ?
```

### Fallback Mode

```python
if os.getenv("SKIP_MODEL_LOAD", "0") == "1":
    # Keyword heuristic classification instead of ML
    return _keyword_classify(text)
```

---

## 8. Usage in Crawling Pipeline

```
Article extracted → Post created (tagsExtracted=false)
         │
         ▼ (within 10 seconds)
post_processor.classify_post(text)
         │
         ▼
posts.label = "Politics"  (category for feed filtering)
posts.lang = "en"         (language detection separate)
         │
         ▼
Feed API returns posts with category label
CategoryBar in frontend filters by label
```

---

## 9. Usage in Telegram Pipeline

Telegram posts follow the same post_processor path once linked to Post entities. Channel-level classification uses tag vectors rather than the classifier service directly.

---

## 10. Thread Safety Configuration

```python
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
torch.set_num_threads(1)
```

Prevents thread contention when running alongside crawler worker threads.

---

## 11. Integration Points

| Consumer | Integration Method |
|----------|-------------------|
| Site Crawler | Embedded in post_processor (direct model load) |
| Standalone API | HTTP POST /predict (port 8002) |
| Admin UI | Not directly called (classification happens automatically) |
| Feed | Reads `posts.label` from database |

---

## 12. Inputs and Outputs

### Inputs
| Input | Type | Description |
|-------|------|-------------|
| `text` | string | Article/post text content |

### Outputs
| Output | Type | Description |
|--------|------|-------------|
| `category` | string | Predicted category label |
| `confidence` | float | Softmax probability (0–1) |

---

## 13. Relationship to Page Classifier

News Bridge uses **two distinct classification models**:

| Model | Location | Purpose | Labels |
|-------|----------|---------|--------|
| Page Classifier | `endpoint_discovery/page_classifier/` | Is this HTML page a listing or article? | listing_article, content_article, other |
| News Classifier | `classifier_service/final_mode_V2/` | What category is this news text? | Politics, Sports, Technology, ... |

These serve different pipeline stages and must not be confused.
