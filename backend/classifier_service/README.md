# News Category Classification Model — Final_Model_V2

## 1. Introduction

The **Final_Model_V2** News Category Classification Model was developed to automatically categorize news articles from multilingual sources into predefined topic categories. The model was designed to support both **Arabic** and **English** news content, making it suitable for integration into a multilingual news aggregation platform.

### Primary Objective

Classify news articles into one of seven categories:

| Class ID | Label     |
|----------|-----------|
| 0        | Culture   |
| 1        | Finance   |
| 2        | Medical   |
| 3        | Politics  |
| 4        | Religion  |
| 5        | Sports    |
| 6        | Tech      |

To achieve robust performance across multiple languages, the model was built upon **XLM-RoBERTa**, a transformer-based multilingual language model developed by Facebook AI.

---

## 2. Model Selection

Several transformer architectures were considered during the design phase, including BERT, RoBERTa, DistilBERT, and other multilingual transformer models.

### Why XLM-RoBERTa?

| Criterion                     | XLM-RoBERTa |
|-------------------------------|-------------|
| Language support              | 100+ languages |
| Multilingual NLP performance  | Strong      |
| Single model for Ar + En      | ✅          |
| Transfer learning via fine-tuning | ✅      |

XLM-RoBERTa was selected because:

- It supports more than 100 languages.
- It provides strong performance on multilingual NLP tasks.
- It can process both Arabic and English using a single model.
- It allows transfer learning through fine-tuning, reducing the amount of task-specific training data required.

The implementation uses the `XLMRobertaForSequenceClassification` architecture provided by the Hugging Face Transformers framework.

---

## 3. Model Configuration

The final model uses the **XLM-RoBERTa Base** configuration:

| Parameter               | Value    |
|-------------------------|----------|
| Hidden Layers           | 12       |
| Attention Heads         | 12       |
| Hidden Size             | 768      |
| Vocabulary Size         | 250,002  |
| Maximum Context Length  | 512 Tokens |
| Inference Sequence Length | 128 Tokens |
| Output Classes          | 7        |
| Activation Function     | GELU     |
| Dropout Probability     | 0.1      |

### File Structure

```
backend/classifier_service/
├── news_classifier_app.py        # FastAPI microservice
├── final_mode_V2/
│   ├── config.json               # Architecture + label mappings
│   ├── model.safetensors         # Trained model weights
│   ├── tokenizer_config.json     # Tokenizer configuration
│   ├── tokenizer.json            # XLM-RoBERTa tokenizer
│   └── training_args.bin         # HuggingFace TrainingArguments
```

---

## 4. Dataset Collection

To support multilingual classification, datasets from both Arabic and English news sources were utilized.

### 4.1 Arabic Dataset — SANAD

The Arabic portion of the training data was based primarily on the **SANAD** dataset, which contains categorized Arabic news articles collected from various news portals. The dataset provides topic labels covering:

- Politics
- Religion
- Sports
- Technology
- Medical topics
- Finance
- Cultural content

All articles are written in **Modern Standard Arabic** and represent a variety of writing styles and source websites.

### 4.2 English Dataset — HuffPost News Category Dataset

The English training corpus was derived from the **HuffPost News Category Dataset**, a large-scale collection of English news headlines and article metadata published between **2012 and 2022**. The dataset contains more than **200,000 categorized news samples** covering a broad range of topics.

#### Source Categories

| Source Category     | Target Class |
|---------------------|--------------|
| Politics            | Politics     |
| Business            | Finance      |
| Sports              | Sports       |
| Technology          | Tech         |
| Religion            | Religion     |
| Science             | Tech         |
| Entertainment       | Culture      |
| Arts & Culture      | Culture      |
| Health & Medical    | Medical      |

#### Label Mapping

The selected categories were mapped to the target taxonomy to ensure consistency with the Arabic dataset:

- **Arts & Culture** articles → **Culture** class
- **Business** articles → **Finance** class
- **Technology** / **Science** articles → **Tech** class
- **Health & Medical** content → **Medical** class

This mapping produced a unified 7-class taxonomy that allowed both Arabic and English samples to train toward the same classification objective, enabling the model to learn language-agnostic semantic representations.

The English dataset was selected to provide balanced category coverage and to complement the Arabic SANAD dataset.

---

## 5. Data Preprocessing

Before training, all datasets underwent a preprocessing pipeline.

### 5.1 Text Cleaning

The following cleaning operations were applied:

- Removal of duplicate articles.
- Removal of invalid records.
- Elimination of empty samples.
- Standardization of whitespace characters.
- Basic normalization of Arabic and English text.

Special transformer tokens and punctuation were preserved where appropriate, as transformer-based models benefit from retaining contextual information.

### 5.2 Label Standardisation

Because the Arabic and English datasets used different category naming conventions, all labels were mapped into a unified taxonomy of seven target classes:

| Class ID | Unified Label |
|----------|---------------|
| 0        | Culture       |
| 1        | Finance       |
| 2        | Medical       |
| 3        | Politics      |
| 4        | Religion      |
| 5        | Sports        |
| 6        | Tech          |

This standardisation allowed multilingual samples to contribute to the same classification objective.

### 5.3 Tokenization

The XLM-RoBERTa tokenizer was used to convert text into subword tokens.

| Setting               | Value   |
|-----------------------|---------|
| Maximum sequence length | 128    |
| Padding               | Automatic (max_length) |
| Truncation            | Automatic |
| Attention masks       | Generated |

Using a sequence length of 128 provided a balance between computational efficiency and classification performance.

---

## 6. Model Fine-Tuning

The pretrained XLM-RoBERTa model was fine-tuned using supervised learning.

### 6.1 Training Objective

The classification head was trained to predict one of the seven news categories using **cross-entropy loss**.

### 6.2 Training Strategy

The multilingual datasets were combined into a single training corpus before fine-tuning. This approach enabled the model to learn **language-independent semantic representations** and reduced the risk of language-specific bias.

The training process consisted of:

1. Loading the pretrained XLM-RoBERTa weights.
2. Replacing the output layer with a seven-class classification head.
3. Fine-tuning all transformer layers on the news classification task.
4. Monitoring validation performance throughout training.
5. Saving the best-performing checkpoint as `Final_Model_V2`.

### 6.3 Optimizer

Training was performed using the **AdamW** optimizer, which is commonly used for transformer architectures due to its stability and strong convergence properties. Regular validation was conducted to minimise overfitting and ensure generalisation across both languages.

---

## 7. Evaluation Methodology

The model was evaluated using a **held-out validation dataset** containing both Arabic and English articles.

### 7.1 Metrics

| Metric      | Monitored |
|-------------|-----------|
| Accuracy    | ✅        |
| Precision   | ✅        |
| Recall      | ✅        |
| F1 Score    | ✅        |

### 7.2 Category Confusion Analysis

Special attention was given to category confusion between semantically related classes:

- Politics ↔ Religion
- Culture ↔ Religion
- Finance ↔ Politics
- Medical ↔ Technology

The multilingual evaluation demonstrated that the model was capable of generalising across both Arabic and English news content while maintaining consistent classification behaviour.

### 7.3 Example Output

```
Input:
"Apple announces a new artificial intelligence processor for future devices."

Output:
Category: Tech
Confidence: 0.97
```

---

## 8. Deployment & Production Integration

After training, the best-performing model checkpoint was exported as `Final_Model_V2` and deployed into the news platform infrastructure through **two parallel integration paths**.

### 8.1 FastAPI Microservice (`news_classifier_app.py`)

A lightweight FastAPI service that loads the model on CPU with optimised threading:

```python
# Environmental optimizations for single-thread CPU inference
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
torch.set_num_threads(1)
```

**Endpoints:**

| Method | Path          | Description                          |
|--------|---------------|--------------------------------------|
| GET    | `/health`     | Health check                         |
| POST   | `/predict`    | Accepts `{ "text": "..." }` → returns category + confidence |

**Request/Response:**

```json
// Request
{ "text": "The stock market reached new highs today as investors reacted to..." }

// Response
{
  "text": "The stock market reached new highs today...",
  "category": "Finance",
  "confidence": 0.94
}
```

This service is designed to be run as an independent container or process, enabling horizontal scaling if needed.

### 8.2 Batch Post-Processor (`post_processor.py`)

A batch-processing script integrated with the MySQL database for bulk classification of pending posts.

**Main function:** `process_pending_posts()`

**Workflow:**

```
1. Connect to MySQL database
2. Query posts WHERE label IS NULL OR TRIM(label) = ''
3. For each post:
   a. Clean text (remove URLs, mentions, extra whitespace)
   b. Detect language (Arabic / English)
   c. Normalize Arabic text (Unicode character mapping)
   d. Call _predict_label() using the XLM-RoBERTa model
   e. Write label + detected language back to the database
4. Repeat for tag extraction (NER + keyword extraction)
```

**Key processing steps in `_predict_label()`:**

```python
def _predict_label(text: str) -> str:
    # 1. Load classifier (lazy-loaded singleton)
    _load_classifier()

    # 2. Tokenize input
    inputs = tokenizer(
        text, return_tensors="pt",
        truncation=True, padding="max_length", max_length=128
    )

    # 3. Run inference
    with torch.no_grad():
        outputs = model(**inputs)
        logits = outputs.logits
        probs = F.softmax(logits, dim=1)
        pred_id = torch.argmax(probs, dim=1).item()

    # 4. Map to label
    return model.config.id2label[pred_id]
```

### 8.3 Fallback Mechanism

If the model fails to load (e.g., missing files or insufficient memory), a **keyword-based heuristic fallback** is used to maintain basic classification service:

```python
def _predict_label(text: str) -> str:
    _load_classifier()
    if not _classifier_available:
        txt = text.lower()
        if any(k in txt for k in ("polit", "election", "government", "minister")):
            return "Politics"
        if any(k in txt for k in ("sport", "match", "goal", "tournament")):
            return "Sports"
        if any(k in txt for k in ("econom", "market", "stock", "business")):
            return "Business"
        return "Uncategorized"
```

This fallback can also be deliberately triggered by setting `SKIP_MODEL_LOAD=1` as an environment variable, which is useful for lightweight or development environments.

### 8.4 Environment Variables

| Variable              | Default                                          | Description                      |
|-----------------------|--------------------------------------------------|----------------------------------|
| `CLASSIFIER_MODEL_PATH` | `./classifier_service/final_mode_V2`           | Path to model directory          |
| `SKIP_MODEL_LOAD`     | `0`                                              | Set to `1` to use heuristic-only |
| `DB_URL`              | `mysql+pymysql://news_user:news_pass@...:3307/` | Database connection string       |

### 8.5 Processing Pipeline Integration

The post-processor is invoked via the command line and can be scheduled (cron, service-manager, etc.):

```bash
python backend/post_processor.py
```

This will:
1. Classify all unlabeled posts in the `posts` table.
2. Extract named entities using two NER pipelines (BERT-based for English, CAMeL-Lab Arabic BERT for Arabic).
3. Extract keywords using YAKE (Yet Another Keyword Extractor).
4. Score and persist tags in the `post_tags` table.
5. Mark posts as processed (`tags_extracted = 1`).

Summary output example:

```
Processed pending posts: {'classified': 142, 'tagged': 142, 'errors': 0}
```

---

## 9. Conclusion

The `Final_Model_V2` model successfully adapts the multilingual capabilities of XLM-RoBERTa for news topic classification. By combining Arabic and English news datasets and applying transfer learning techniques, the model provides a unified solution capable of categorising multilingual news articles into seven meaningful categories.

### Production Architecture Overview

```
                         ┌─────────────────────────────┐
                         │    news_classifier_app.py    │
                         │   (FastAPI /predict REST)    │
                         └──────────┬──────────────────┘
                                    │ HTTP
                         ┌──────────▼──────────────────┐
                         │   final_mode_V2/             │
                         │   XLM-RoBERTa model files    │
                         └──────────┬──────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
  ┌───────────▼──────────┐  ┌──────▼───────┐  ┌─────────▼──────────┐
  │  post_processor.py   │  │  Crawler     │  │  External Services │
  │  (database batch)    │  │  Pipeline    │  │  (future use)      │
  └───────────┬──────────┘  └──────────────┘  └────────────────────┘
              │
    ┌─────────▼─────────┐
    │   MySQL Database  │
    │   posts.label     │
    │   post_tags       │
    └───────────────────┘
```

The resulting system is suitable for integration into modern news aggregation and recommendation platforms where automatic content organisation is required.