import os
import re
from datetime import datetime
import yake
from langdetect import detect
from sqlalchemy import create_engine, text
from transformers import pipeline, AutoTokenizer, AutoModelForTokenClassification
import torch

# ----------------------------
# 🔥 CONFIGURATION
# ----------------------------
DB_CONFIG = {
    "user": "root",
    "password": "1234",
    "host": "localhost",
    "database": "news_bridge_database"
}
DATABASE_URL = f"mysql+pymysql://{DB_CONFIG['user']}:{DB_CONFIG['password']}@{DB_CONFIG['host']}/{DB_CONFIG['database']}"

engine = create_engine(DATABASE_URL)

DEVICE = 0 if torch.cuda.is_available() else -1
print(f"💻 Using device: {'CUDA' if DEVICE==0 else 'CPU'}")

# ----------------------------
# 🔥 MODEL LOADING
# ----------------------------
print("🔄 Loading NER models on device...")

ner_en = pipeline(
    "ner",
    model="dslim/bert-base-NER",
    aggregation_strategy="simple",
    device=DEVICE
)

ner_ar = pipeline(
    "ner",
    model="CAMeL-Lab/bert-base-arabic-camelbert-msa-ner",
    aggregation_strategy="simple",
    device=DEVICE
)

kw_extractor_en = yake.KeywordExtractor(lan="en", n=2, top=10)
kw_extractor_ar = yake.KeywordExtractor(lan="ar", n=2, top=10)

print("✅ Models loaded successfully")

# ----------------------------
# 🔧 UTILITIES
# ----------------------------
AR_STOPWORDS = {"في", "على", "من", "الى", "عن", "مع", "هذا", "ذلك", "علي", "فيه", "كما", "تم", "بعد", "قبل"}

def clean_text(text: str) -> str:
    if not text: return ""
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
    except:
        return "en"

# ----------------------------
# 🔥 CORE TAGGING LOGIC
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

def extract_keywords(text: str, lang: str):
    extractor = kw_extractor_ar if lang == "ar" else kw_extractor_en
    keywords = []
    try:
        for kw, score in extractor.extract_keywords(text):
            kw = kw.strip()
            keywords.append((kw, 1 - score))  # invert YAKE score
    except Exception as e:
        print("YAKE error:", e)
    return keywords

def score_tags(text, entities, keywords, lang):
    tag_scores = {}
    text_lower = text.lower()
    for e in entities:
        key = e.lower()
        if len(e) < 3: continue
        score = 0.9 + min(text_lower.count(key) * 0.05, 0.1)
        tag_scores[key] = {"tag": e, "score": round(score, 3), "type": "entity"}
    for kw, base_score in keywords:
        key = kw.lower()
        if key in tag_scores or (lang == "ar" and kw in AR_STOPWORDS) or len(kw)<3:
            continue
        score = 0.5 + base_score * 0.4
        tag_scores[key] = {"tag": kw, "score": round(score, 3), "type": "keyword"}
    return sorted(tag_scores.values(), key=lambda x: x["score"], reverse=True)[:10]

# ----------------------------
# 🔧 DATABASE LOGIC
# ----------------------------
def init_db():
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
        result = conn.execute(text("SELECT id, text FROM posts WHERE tags_extracted = 0"))
        posts = result.fetchall()
        if not posts:
            print("📭 No pending posts found.")
            return
        print(f"🚀 Processing {len(posts)} posts...")
        for post_id, raw_text in posts:
            try:
                text_clean = clean_text(raw_text)
                lang = detect_language(text_clean)
                if lang == "ar": text_clean = normalize_arabic(text_clean)

                entities = extract_entities(text_clean, lang)
                keywords = extract_keywords(text_clean, lang)
                final_tags = score_tags(text_clean, entities, keywords, lang)

                # Insert tags
                for t in final_tags:
                    conn.execute(
                        text("INSERT INTO posts_tags (post_id, tag, score, tag_type) VALUES (:pid, :tag, :score, :type)"),
                        {"pid": post_id, "tag": t["tag"], "score": t["score"], "type": t["type"]}
                    )

                # Mark post as processed
                conn.execute(
                    text("UPDATE posts SET tags_extracted = 1, extracted_at = :now WHERE id = :pid"),
                    {"now": datetime.now(), "pid": post_id}
                )
                conn.commit()
                print(f"✅ Post ID {post_id} processed")
            except Exception as e:
                print(f"❌ Error processing post {post_id}: {e}")
                conn.rollback()

# ----------------------------
# 🔥 MAIN EXECUTION
# ----------------------------
if __name__ == "__main__":
    print("🚀 Starting Tag Extraction Service...")
    process_pending_posts()
    print("🎉 All pending posts processed")
