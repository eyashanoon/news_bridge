from __future__ import annotations

import os
import re
import logging
from datetime import datetime
from pathlib import Path
from typing import Any

import torch
import torch.nn.functional as F
import yake
from langdetect import detect
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from transformers import AutoModelForSequenceClassification, AutoTokenizer, pipeline


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("post_processor")


DB_USER = os.getenv("DB_USERNAME", "news_user")
DB_PASSWORD = os.getenv("DB_PASSWORD", "news_pass")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "3307")
DB_NAME = os.getenv("DB_NAME", "news_crawler")
DB_URL = os.getenv(
    "DB_URL",
    f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

CLASSIFIER_MODEL_PATH = os.getenv(
    "CLASSIFIER_MODEL_PATH",
    str(Path(__file__).resolve().parent / "classifier_service" / "final_mode_V2"),
)

engine = create_engine(DB_URL, future=True)

_classifier_tokenizer = None
_classifier_model = None
_classifier_device = None
_tag_ner_en = None
_tag_ner_ar = None
_kw_extractor_en = None
_kw_extractor_ar = None
_classifier_available = False
_tag_models_available = False


def clean_text(text: str) -> str:
    if not text:
        return ""
    text = text.replace("\n", " ").replace("\r", " ")
    text = re.sub(r"http\S+|@\w+|#", "", text)
    return re.sub(r"\s+", " ", text).strip()


def normalize_arabic(text: str) -> str:
    text = re.sub("[إأآا]", "ا", text)
    text = re.sub("ى", "ي", text)
    text = re.sub("ؤ", "و", text)
    text = re.sub("ئ", "ي", text)
    text = re.sub("ة", "ه", text)
    text = re.sub(r"[\u0617-\u061A\u064B-\u0652]", "", text)
    return re.sub(r"ـ", "", text)


def detect_language(text: str) -> str:
    try:
        return "ar" if detect(text).startswith("ar") else "en"
    except Exception:
        return "en"


def _load_classifier() -> None:
    global _classifier_tokenizer, _classifier_model, _classifier_device
    global _classifier_available
    if _classifier_model is not None:
        _classifier_available = True
        return

    # Allow forcing fallback to lightweight processing to avoid heavy model loads
    if os.getenv("SKIP_MODEL_LOAD", "0") == "1":
        print("⚠️ SKIP_MODEL_LOAD set — skipping classifier model load and using fallback")
        _classifier_available = False
        return

    print(f"🔄 Loading classifier model from {CLASSIFIER_MODEL_PATH}...")
    _classifier_device = "cpu"
    model_path_str = str(CLASSIFIER_MODEL_PATH)
    try:
        _classifier_tokenizer = AutoTokenizer.from_pretrained(model_path_str, local_files_only=True)
        _classifier_model = AutoModelForSequenceClassification.from_pretrained(
            model_path_str,
            local_files_only=True,
        )
        _classifier_model.to(_classifier_device)
        _classifier_model.eval()
        _classifier_available = True
        print("✅ Classifier model loaded")
    except Exception as e:
        _classifier_available = False
        print(f"⚠️ Classifier model failed to load: {e}")


def _load_tag_models() -> None:
    global _tag_ner_en, _tag_ner_ar, _kw_extractor_en, _kw_extractor_ar
    global _tag_models_available
    if (_tag_ner_en is not None and _tag_ner_ar is not None) or _tag_models_available:
        _tag_models_available = True
        return

    # Allow skipping heavy tag model loads for quick fallback runs
    if os.getenv("SKIP_MODEL_LOAD", "0") == "1":
        print("⚠️ SKIP_MODEL_LOAD set — skipping tag model loads and using fallback")
        _tag_models_available = False
        return

    print("🔄 Loading tag extractor models...")
    try:
        _tag_ner_en = pipeline("ner", model="dslim/bert-base-NER", aggregation_strategy="simple")
        _tag_ner_ar = pipeline("ner", model="CAMeL-Lab/bert-base-arabic-camelbert-msa-ner", aggregation_strategy="simple")
        _kw_extractor_en = yake.KeywordExtractor(lan="en", n=2, top=10)
        _kw_extractor_ar = yake.KeywordExtractor(lan="ar", n=2, top=10)
        _tag_models_available = True
        print("✅ Tag extractor models loaded")
    except Exception as e:
        _tag_models_available = False
        print(f"⚠️ Tag extractor models failed to load: {e}")


def _predict_label(text: str) -> str:
    _load_classifier()
    if not _classifier_available or _classifier_model is None:
        # Fallback: simple heuristic based on keywords
        txt = text.lower()
        if any(k in txt for k in ("polit", "election", "government", "minister")):
            return "Politics"
        if any(k in txt for k in ("sport", "match", "goal", "tournament")):
            return "Sports"
        if any(k in txt for k in ("econom", "market", "stock", "business")):
            return "Business"
        return "Uncategorized"

    inputs = _classifier_tokenizer(
        text,
        return_tensors="pt",
        truncation=True,
        padding="max_length",
        max_length=128,
    ).to(_classifier_device)

    with torch.no_grad():
        outputs = _classifier_model(**inputs)
        logits = outputs.logits
        probs = F.softmax(logits, dim=1)
        pred_id = torch.argmax(probs, dim=1).item()

    return _classifier_model.config.id2label[pred_id]


def _extract_entities(text: str, lang: str) -> list[str]:
    _load_tag_models()
    if not _tag_models_available or (_tag_ner_en is None and _tag_ner_ar is None):
        return []

    ner_pipe = _tag_ner_ar if lang == "ar" else _tag_ner_en
    results = []
    try:
        results = ner_pipe(text)
    except Exception:
        return []
    entities: list[str] = []
    current = ""

    for item in results:
        word = item.get("word", "").replace("##", "")
        if item.get("word", "").startswith("##") and current:
            current += word
        else:
            if current:
                entities.append(current.strip())
            current = word

    if current:
        entities.append(current.strip())

    return [e for e in entities if len(e) >= 3]


def _extract_keywords(text: str, lang: str) -> list[tuple[str, float]]:
    _load_tag_models()
    extractor = _kw_extractor_ar if lang == "ar" else _kw_extractor_en
    if extractor is None:
        # Very small fallback: split words and return top tokens
        words = [w for w in re.findall(r"\w+", text.lower()) if len(w) > 3]
        freq = {}
        for w in words:
            freq[w] = freq.get(w, 0) + 1
        items = sorted(freq.items(), key=lambda x: x[1], reverse=True)[:10]
        return [(k, min(0.9, 0.2 + v * 0.1)) for k, v in items]
    try:
        results = extractor.extract_keywords(text)
        return [(kw.strip(), 1 - score) for kw, score in results if kw and len(kw.strip()) >= 3]
    except Exception:
        return []


def _score_tags(text: str, entities: list[str], keywords: list[tuple[str, float]], lang: str) -> list[dict[str, Any]]:
    tag_scores: dict[str, dict[str, Any]] = {}
    text_lower = text.lower()

    for e in entities:
        key = e.lower()
        if key in tag_scores:
            continue
        score = 0.9 + min(text_lower.count(key) * 0.05, 0.1)
        tag_scores[key] = {
            "tag": e,
            "score": round(score, 3),
            "type": "entity",
        }

    for kw, base_score in keywords:
        key = kw.lower()
        if key in tag_scores:
            continue
        if lang == "ar" and kw in {"في", "على", "من", "الى", "عن", "مع", "هذا", "ذلك", "علي", "فيه", "كما", "تم", "بعد", "قبل"}:
            continue
        score = 0.5 + base_score * 0.4
        tag_scores[key] = {
            "tag": kw,
            "score": round(score, 3),
            "type": "keyword",
        }

    return sorted(tag_scores.values(), key=lambda item: item["score"], reverse=True)[:10]


def _ensure_post_tags_table() -> None:
    with engine.begin() as conn:
        conn.execute(text(
            """
            CREATE TABLE IF NOT EXISTS post_tags (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                post_id BIGINT NOT NULL,
                tag VARCHAR(255) NOT NULL,
                UNIQUE KEY idx_post_tag (post_id, tag),
                FOREIGN KEY (post_id) REFERENCES posts(id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """
        ))


def process_pending_posts() -> dict[str, int]:
    summary = {"classified": 0, "tagged": 0, "errors": 0}
    _ensure_post_tags_table()
    
    logger.info("Starting process_pending_posts...")

    try:
        with engine.begin() as conn:
            # Fetch and classify posts
            logger.debug("Fetching posts without classification (label IS NULL)...")
            posts_to_classify = conn.execute(
                text("SELECT id, text FROM posts WHERE label IS NULL OR TRIM(label) = ''")
            ).fetchall()
            logger.info(f"Found {len(posts_to_classify)} posts to classify")

            for row in posts_to_classify:
                post_id = row[0]
                raw_text = row[1] or ""
                text_clean = clean_text(raw_text)
                lang = detect_language(text_clean)

                if lang == "ar":
                    text_clean = normalize_arabic(text_clean)

                try:
                    label = _predict_label(text_clean)
                    conn.execute(
                        text("UPDATE posts SET label = :label, lang = :lang WHERE id = :post_id"),
                        {"label": label, "lang": lang, "post_id": post_id},
                    )
                    summary["classified"] += 1
                    logger.debug(f"Classified post {post_id}: {label}")
                except Exception as e:
                    summary["errors"] += 1
                    logger.error(f"Error classifying post {post_id}: {e}")
                    continue

            # Fetch and tag posts
            logger.debug("Fetching posts without tags (tags_extracted = 0)...")
            posts_to_tag = conn.execute(
                text("SELECT id, text FROM posts WHERE tags_extracted = 0")
            ).fetchall()
            logger.info(f"Found {len(posts_to_tag)} posts to tag")

            for row in posts_to_tag:
                post_id = row[0]
                raw_text = row[1] or ""
                text_clean = clean_text(raw_text)
                lang = detect_language(text_clean)

                if lang == "ar":
                    text_clean = normalize_arabic(text_clean)

                try:
                    entities = _extract_entities(text_clean, lang)
                    keywords = _extract_keywords(text_clean, lang)
                    scored_tags = _score_tags(text_clean, entities, keywords, lang)

                    tag_count = 0
                    for tag_result in scored_tags:
                        tag = tag_result["tag"]
                        try:
                            conn.execute(
                                text("INSERT IGNORE INTO post_tags (post_id, tag) VALUES (:post_id, :tag)"),
                                {"post_id": post_id, "tag": tag},
                            )
                            tag_count += 1
                        except SQLAlchemyError as e:
                            logger.warning(f"Error inserting tag {tag} for post {post_id}: {e}")
                            continue

                    conn.execute(
                        text("UPDATE posts SET tags_extracted = 1 WHERE id = :post_id"),
                        {"post_id": post_id},
                    )
                    summary["tagged"] += 1
                    logger.debug(f"Tagged post {post_id} with {tag_count} tags")
                except Exception as e:
                    summary["errors"] += 1
                    logger.error(f"Error tagging post {post_id}: {e}")
                    continue
                    
    except Exception as ex:
        logger.error(f"Critical error in process_pending_posts: {ex}")
        summary["errors"] += 1
        
    logger.info(f"process_pending_posts completed: classified={summary['classified']}, "
                f"tagged={summary['tagged']}, errors={summary['errors']}")
    return summary


if __name__ == "__main__":
    results = process_pending_posts()
    print(f"Processed pending posts: {results}")
