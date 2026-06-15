# Web Extractor (Content Extraction Library)

## 1. Component Identity

| Property | Value |
|----------|-------|
| **Path** | `backend/extractor/` |
| **Type** | Python library (not a standalone HTTP service) |
| **Public API** | `extractor.content_model.extract_article(url, html=...)` |
| **Core implementation** | `backend/extractor/content_model/extract_dl.py` |
| **Model weights** | `dl_article_model_url_supervised.pt` |

The Web Extractor transforms raw HTML from news article pages into structured content: title, ordered text blocks, and media elements. It uses a **deep-learning block classifier** (PyTorch) to score DOM nodes and filter boilerplate.

---

## 2. Role in the Pipeline

```
Site Crawler identifies article URL
         │
         ▼
web_fetch.fetch_html(url) → raw HTML
         │
         ▼
extract_article(url, html=html)
         │
         ▼
{
  title: "...",
  blocks: [
    {type: "text", content: "...", order: 0},
    {type: "image", src: "...", alt: "...", order: 1},
    ...
  ]
}
         │
         ▼
POST /articles → Spring Boot persists Article + ArticleBlocks
```

---

## 3. Extraction Pipeline

**File:** `backend/extractor/content_model/extract_dl.py`

### 3.1 High-Level Algorithm

```
1. Parse HTML with BeautifulSoup
2. Identify candidate DOM blocks (paragraphs, divs, sections, figures)
3. For each block:
   a. Extract numeric + textual features (features.py)
   b. BlockClassifier model scores: P(text), P(media), P(title)
4. Filter blocks below thresholds:
   - text_thr = 0.62
   - media_thr = 0.75
   - title_thr = 0.30
5. Remove noise sections (related stories, footers, ads)
6. Order blocks by DOM position
7. Extract title from highest-scoring title block or <h1>/<title>
8. Return structured dict
```

### 3.2 Block Classifier Model

**File:** `backend/extractor/content_model/model.py` — class `BlockClassifier`

- PyTorch neural network
- Input: feature vector per DOM block
- Output: multi-class probabilities (text, media, title, noise)

**Features** (`features.py`):
- Tag name, class/id hints
- Text length, word count, link density
- Image/video presence
- Position in document (relative depth, sibling index)
- CSS class keyword signals

---

## 4. DOM Parsing Strategy

### 4.1 Candidate Block Selection

Traverses DOM tree collecting block-level elements:
- Text containers: `<p>`, `<blockquote>`, `<div>` with substantial text
- Media: `<img>`, `<video>`, `<figure>`, `<picture>`
- Headings: `<h1>`–`<h6>` for title candidates

### 4.2 Ignored Tags

```python
IGNORED_TAGS = {
    "script", "style", "noscript", "template",
    "meta", "link", "head", "title", "svg"
}
```

### 4.3 Body Text Tags

```python
BODY_TEXT_TAGS = {"p", "blockquote"}
```

Primary article paragraphs identified from these tags when classifier confidence is high.

---

## 5. Boilerplate Removal Techniques

### 5.1 Section Hint Filtering

**STOP_SECTION_HINTS** — entire sections skipped when heading/ancestor text matches:

```
English: "related", "more from", "most read", "recommended",
         "you may also", "trending", "editor picks"
Arabic:  "إقرأ المزيد", "ذات صلة", "الأكثر قراءة", "قد يعجبك"
```

When a section heading matches, all descendant blocks are excluded from extraction.

### 5.2 Noise Class/ID Filtering

**NOISE_HINTS** — CSS class/id substring matches:

```
"related", "recommend", "footer", "header", "nav", "menu",
"promo", "taboola", "advert", "share", "social", "cookie",
"newsletter", "trending", "most-read", "onetrust", ...
```

Blocks within elements matching these hints receive penalty or exclusion.

### 5.3 UI Noise Text Filtering

**UI_NOISE_TEXTS** — short UI strings removed:

```
"advertisement", "save", "share", "copy link", "subscribe", ...
```

### 5.4 Recommendation Rail Removal

Explicit handling for on-page "recommended stories" modules that appear mid-article — prevents polluting extracted text with unrelated headlines.

---

## 6. Text Extraction Pipeline

### 6.1 Text Block Assembly

1. Classifier identifies high-confidence text blocks
2. Blocks sorted by DOM document order
3. Adjacent short blocks may be merged
4. Whitespace normalized
5. Empty blocks discarded

### 6.2 Title Extraction

Priority order:
1. Block with highest title-classifier score above `title_thr`
2. First `<h1>` with substantial text
3. `<title>` tag content (cleaned)
4. Open Graph `og:title` meta tag

### 6.3 Media Extraction

For blocks classified as media:
- **Images:** `src`, `alt`, `width`, `height`, responsive `srcset`
- **Videos:** `src`, poster, embed URLs
- URLs resolved relative to article URL via `urljoin`

---

## 7. Article Extraction Rules

| Rule | Implementation |
|------|----------------|
| Minimum content | Effectively enforced by classifier thresholds |
| Single title | Highest-scoring title block selected |
| Preserve order | DOM traversal order maintained |
| Skip navigation | NOISE_HINTS + STOP_SECTION_HINTS |
| Multilingual | Feature extraction language-agnostic; Arabic content supported |
| Relative URLs | Resolved to absolute via `urljoin(article_url, src)` |

---

## 8. Threshold Configuration

Default thresholds in `extract_article()`:

```python
text_thr = 0.62   # Minimum P(text) to include paragraph
media_thr = 0.75  # Minimum P(media) to include image/video
title_thr = 0.30  # Minimum P(title) to select as headline
```

These can be tuned per deployment; lower thresholds increase recall at cost of noise.

---

## 9. Integration Points

### Called By
- `crawler_server/crawler_service.py` — `_process_candidate()` after article classification
- `crawler_server/main.py` — direct import for testing

### Depends On
- Pre-fetched HTML from `web_fetch` (avoids double-fetch when HTML provided)
- PyTorch runtime for model inference
- BeautifulSoup4 for DOM parsing

### Output Contract (Spring Boot)

Extracted content mapped to `CreateArticleRequest`:
- `title` → ArticleTitle entity
- Text blocks → ArticleTextBlock entities with order index
- Media blocks → ArticleImageBlock / VideoBlock entities

---

## 10. Testing & Development Utilities

| File | Purpose |
|------|---------|
| `content_model/view_extraction.py` | Visual/debug extraction results |
| `content_model/generate_test_htmls.py` | Generate test fixtures |
| `content_model/extract_dl.py` CLI | `--url` argument for standalone testing |

---

## 11. Performance Considerations

- Model loaded once at import time (singleton)
- CPU inference by default
- Feature extraction is O(n) in DOM node count
- Large pages (>5MB HTML) typically rejected upstream by `web_fetch`

---

## 12. Inputs and Outputs

### Inputs
| Input | Type | Description |
|-------|------|-------------|
| `url` | str | Article URL (for relative link resolution) |
| `html` | str (optional) | Pre-fetched HTML; fetches if omitted |

### Outputs
```python
{
    "url": str,
    "title": str,
    "blocks": [
        {"type": "text", "content": str, "order": int},
        {"type": "image", "src": str, "alt": str, "order": int},
        {"type": "video", "src": str, "order": int},
        ...
    ]
}
```

Empty or failed extraction returns minimal structure; crawler logs and skips article creation.
