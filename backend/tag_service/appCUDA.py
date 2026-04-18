import re
from fastapi import FastAPI
from contextlib import asynccontextmanager
from pydantic import BaseModel
from langdetect import detect
from transformers import pipeline
import yake

# ----------------------------
# 🌟 Lifespan Event: Load Models on Startup
# ----------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    global ner_en, ner_ar, kw_extractor_en, kw_extractor_ar

    # GPU device (0 = first GPU, -1 = CPU)
    import torch
    device = 0 if torch.cuda.is_available() else -1
    print(f"🔄 Loading models on {'GPU' if device != -1 else 'CPU'}...")

    # NER Pipelines
    ner_en = pipeline(
        "ner",
        model="dslim/bert-base-NER",
        aggregation_strategy="simple",
        device=device
    )

    ner_ar = pipeline(
        "ner",
        model="CAMeL-Lab/bert-base-arabic-camelbert-msa-ner",
        aggregation_strategy="simple",
        device=device
    )

    # YAKE Keyword Extractors
    kw_extractor_en = yake.KeywordExtractor(lan="en", n=2, top=10)
    kw_extractor_ar = yake.KeywordExtractor(lan="ar", n=2, top=10)

    print("✅ Models loaded")
    yield
    print("🛑 Shutting down")


# ----------------------------
# FastAPI App
# ----------------------------
app = FastAPI(title="Advanced Tag Extraction Service", lifespan=lifespan)


# ----------------------------
# Request Body
# ----------------------------
class PostRequest(BaseModel):
    text: str
    max_tags: int = 10


# ----------------------------
# Utilities
# ----------------------------
AR_STOPWORDS = {
    "في", "على", "من", "الى", "عن", "مع", "هذا", "ذلك",
    "علي", "فيه", "كما", "تم", "بعد", "قبل"
}


def clean_text(text: str) -> str:
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
# NER ENTITY EXTRACTION
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
# YAKE KEYWORD EXTRACTION
# ----------------------------
def extract_keywords(text: str, lang: str):
    extractor = kw_extractor_ar if lang == "ar" else kw_extractor_en
    keywords = []

    try:
        results = extractor.extract_keywords(text)
        for kw, score in results:
            kw = kw.strip()
            score = 1 - score  # YAKE score is inverse
            keywords.append((kw, score))
    except Exception as e:
        print("YAKE error:", e)

    return keywords


# ----------------------------
# TAG SCORING
# ----------------------------
def score_tags(text, entities, keywords, lang):
    tag_scores = {}
    text_lower = text.lower()

    # Entities (high weight)
    for e in entities:
        key = e.lower()
        if len(e) < 3:
            continue
        score = 0.9 + min(text_lower.count(key) * 0.05, 0.1)
        tag_scores[key] = {"tag": e, "score": round(score, 3), "type": "entity"}

    # Keywords
    for kw, base_score in keywords:
        key = kw.lower()
        if key in tag_scores or (lang == "ar" and kw in AR_STOPWORDS) or len(kw) < 3:
            continue
        score = 0.5 + base_score * 0.4
        tag_scores[key] = {"tag": kw, "score": round(score, 3), "type": "keyword"}

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

    # Sort by score
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
