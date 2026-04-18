
import os
import re
import yake
import cryptography
from datetime import datetime
from langdetect import detect
from transformers import pipeline
from sqlalchemy import create_engine, text

# --- CONFIGURATION ---
DB_CONFIG = {
    "user": "root",
    "password": "1234",
    "host": "localhost",
    "database": "news_bridge_database"
}
# Connection string: mysql+pymysql://user:pass@host/dbname
DATABASE_URL = f"mysql+pymysql://{DB_CONFIG['user']}:{DB_CONFIG['password']}@{DB_CONFIG['host']}/{DB_CONFIG['database']}"

engine = create_engine(DATABASE_URL)

# --- MODEL LOADING (Same as before) ---
print("🔄 Loading models...")
ner_en = pipeline("ner", model="dslim/bert-base-NER", aggregation_strategy="simple")
ner_ar = pipeline("ner", model="CAMeL-Lab/bert-base-arabic-camelbert-msa-ner", aggregation_strategy="simple")
kw_extractor_en = yake.KeywordExtractor(lan="en", n=2, top=10)
kw_extractor_ar = yake.KeywordExtractor(lan="ar", n=2, top=10)
print("✅ Models loaded")

# --- UTILITIES ---
AR_STOPWORDS = {"في", "على", "من", "الى", "عن", "مع", "هذا", "ذلك", "علي", "فيه", "كما", "تم", "بعد", "قبل"}

def clean_text(text_str: str) -> str:
    if not text_str: return ""
    text_str = text_str.replace("\n", " ").replace("\r", " ")
    text_str = re.sub(r"http\S+|@\w+|#", "", text_str)
    return re.sub(r"\s+", " ", text_str).strip()

def normalize_arabic(text_str: str) -> str:
    text_str = re.sub("[إأآا]", "ا", text_str)
    text_str = re.sub("ى", "ي", text_str); text_str = re.sub("ؤ", "و", text_str)
    text_str = re.sub("ئ", "ي", text_str); text_str = re.sub("ة", "ه", text_str)
    text_str = re.sub(r"[\u0617-\u061A\u064B-\u0652]", "", text_str)
    return re.sub(r"ـ", "", text_str)

def detect_language(text_str: str) -> str:
    try: return "ar" if detect(text_str).startswith("ar") else "en"
    except: return "en"

# --- CORE LOGIC ---
def extract_entities(text_str: str, lang: str):
    ner_pipe = ner_ar if lang == "ar" else ner_en
    try:
        results = ner_pipe(text_str)
        return [r["word"].replace("##", "").strip() for r in results if len(r["word"]) > 2]
    except: return []

def extract_keywords(text_str: str, lang: str):
    extractor = kw_extractor_ar if lang == "ar" else kw_extractor_en
    try:
        results = extractor.extract_keywords(text_str)
        return [(kw.strip(), 1 - score) for kw, score in results]
    except: return []

def score_tags(text_str, entities, keywords, lang):
    tag_scores = {}
    text_lower = text_str.lower()

    for e in entities:
        key = e.lower()
        score = 0.9 + min(text_lower.count(key) * 0.05, 0.1)
        tag_scores[key] = {"tag": e, "score": round(score, 3), "type": "entity"}

    for kw, base_score in keywords:
        key = kw.lower()
        if key in tag_scores or (lang == "ar" and kw in AR_STOPWORDS): continue
        tag_scores[key] = {"tag": kw, "score": round(0.5 + base_score * 0.4, 3), "type": "keyword"}

    return sorted(tag_scores.values(), key=lambda x: x["score"], reverse=True)[:10]

# --- DATABASE SYNC ---
def init_db():
    """Creates the posts_tags table if it doesn't exist."""
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS posts_tags (
                id INT AUTO_INCREMENT PRIMARY KEY,
                post_id INT NOT NULL,
                tag VARCHAR(255),
                score FLOAT,
                tag_type VARCHAR(50),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """))
        conn.commit()

def process_pending_posts():
    init_db()

    with engine.connect() as conn:
        # 1. Fetch posts where tags_extracted = 0
        result = conn.execute(text("SELECT id, text FROM posts WHERE tags_extracted = 0"))
        posts = result.fetchall()

        if not posts:
            print("📭 No pending posts found.")
            return

        print(f"🚀 Processing {len(posts)} posts...")

        for post_id, raw_text in posts:
            try:
                # ML Pipeline
                text_clean = clean_text(raw_text)
                lang = detect_language(text_clean)
                if lang == "ar": text_clean = normalize_arabic(text_clean)

                entities = extract_entities(text_clean, lang)
                keywords = extract_keywords(text_clean, lang)
                final_tags = score_tags(text_clean, entities, keywords, lang)

                # 2. Insert into posts_tags
                for t in final_tags:
                    conn.execute(
                        text("INSERT INTO posts_tags (post_id, tag, score, tag_type) VALUES (:pid, :tag, :score, :type)"),
                        {"pid": post_id, "tag": t["tag"], "score": t["score"], "type": t["type"]}
                    )

                # 3. Update original post status
                conn.execute(
                    text("UPDATE posts SET tags_extracted = 1, extracted_at = :now WHERE id = :pid"),
                    {"now": datetime.now(), "pid": post_id}
                )

                conn.commit()
                print(f"✅ Processed Post ID: {post_id}")

            except Exception as e:
                print(f"❌ Error processing post {post_id}: {e}")
                conn.rollback()

if __name__ == "__main__":
    process_pending_posts()
os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
os.environ["TRANSFORMERS_NO_ADVISORY_WARNINGS"] = "1"

from fastapi import FastAPI
from pydantic import BaseModel
from langdetect import detect
from sentence_transformers import SentenceTransformer
from transformers import pipeline
import yake
import re

app = FastAPI(title="Advanced Tag Extraction Service")

# ----------------------------
# 🔥 Load Models ONCE
# ----------------------------
@app.on_event("startup")
def load_models():
    global ner_en, ner_ar, kw_extractor_en, kw_extractor_ar

    print("🔄 Loading models...")

    ner_en = pipeline(
        "ner",
        model="dslim/bert-base-NER",
        aggregation_strategy="simple"
    )

    ner_ar = pipeline(
        "ner",
        model="CAMeL-Lab/bert-base-arabic-camelbert-msa-ner",
        aggregation_strategy="simple"
    )

    # ✅ YAKE keyword extractors
    kw_extractor_en = yake.KeywordExtractor(
        lan="en",
        n=2,
        top=10
    )

    kw_extractor_ar = yake.KeywordExtractor(
        lan="ar",
        n=2,
        top=10
    )

    print("✅ Models loaded")


# ----------------------------
# Request Body
# ----------------------------
class PostRequest(BaseModel):
    text: str
    max_tags: int = 10


# ----------------------------
# Helpers
# ----------------------------

AR_STOPWORDS = {
    "في", "على", "من", "الى", "عن", "مع", "هذا", "ذلك",
    "علي", "فيه", "كما", "تم", "بعد", "قبل"
}


def clean_text(text: str) -> str:
    text = text.replace("\n", " ")  # 🔥 fix line breaks
    text = text.replace("\r", " ")
    text = re.sub(r"http\S+", "", text)
    text = re.sub(r"@\w+", "", text)
    text = re.sub(r"#", "", text)
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
    except:
        return "en"


# ----------------------------
# 🔥 ENTITY EXTRACTION
# ----------------------------
def extract_entities(text: str, lang: str):
    ner_pipe = ner_ar if lang == "ar" else ner_en
    entities = []

    try:
        results = ner_pipe(text)

        current = ""
        for r in results:
            word = r.get("word", "").replace("##", "")

            if r.get("word", "").startswith("##"):
                current += word
            else:
                if current:
                    entities.append(current.strip())
                current = word

        if current:
            entities.append(current.strip())

    except Exception as e:
        print("NER error:", e)

    return entities


# ----------------------------
# ⚡ YAKE KEYWORDS
# ----------------------------
def extract_keywords(text: str, lang: str):
    extractor = kw_extractor_ar if lang == "ar" else kw_extractor_en
    keywords = []

    try:
        results = extractor.extract_keywords(text)

        for kw, score in results:
            kw = kw.strip()

            # YAKE score is inverse → convert
            score = 1 - score

            keywords.append((kw, score))

    except Exception as e:
        print("YAKE error:", e)

    return keywords


# ----------------------------
# 📊 TAG SCORING
# ----------------------------
def score_tags(text, entities, keywords, lang):
    tag_scores = {}
    text_lower = text.lower()

    # 🔥 Entities (high score)
    for e in entities:
        key = e.lower()

        if len(e) < 3:
            continue

        score = 0.9

        # frequency boost
        freq = text_lower.count(key)
        score += min(freq * 0.05, 0.1)

        tag_scores[key] = {
            "tag": e,
            "score": round(score, 3),
            "type": "entity"
        }

    # ⚡ Keywords
    for kw, base_score in keywords:
        key = kw.lower()

        if key in tag_scores:
            continue

        if len(kw) < 3:
            continue

        if lang == "ar" and kw in AR_STOPWORDS:
            continue

        score = 0.5 + base_score * 0.4

        tag_scores[key] = {
            "tag": kw,
            "score": round(score, 3),
            "type": "keyword"
        }

    return list(tag_scores.values())


# ----------------------------
# API Endpoint
# ----------------------------
@app.post("/extract-tags")
def extract_tags(req: PostRequest):
    text = clean_text(req.text)
    lang = detect_language(text)

    if lang == "ar":
        text = normalize_arabic(text)

    entities = extract_entities(text, lang)
    keywords = extract_keywords(text, lang)

    scored_tags = score_tags(text, entities, keywords, lang)

    # 🔥 Sort by score
    scored_tags = sorted(scored_tags, key=lambda x: x["score"], reverse=True)

    return {
        "language": lang,
        "tags": scored_tags[:req.max_tags],
        "entities_found": len(entities),
        "keywords_found": len(keywords)
    }


@app.get("/")
def root():
    return {"status": "Advanced Tag Service Running"}
