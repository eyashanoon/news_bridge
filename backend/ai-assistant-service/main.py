import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from apscheduler.schedulers.background import BackgroundScheduler

from router import route_request
from logic.post_logic import summarize_post
from logic.topic_logic import topic_search
from logic.news_brief import build_news_brief
from core.llm import generate, generate_news_brief, translate_text

from ingestion.fetcher import fetch_post_content
from ingestion.processor import merge_paragraphs
from rag.ingest import ingest_post
from rag.global_store import store, ingested_posts, persist_ingested
from rag.scheduler import auto_ingest_job

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle: startup and shutdown events."""
    logger.info("Starting up AI Assistant Service...")
    logger.info(
        f"Vector store loaded with {len(store)} vectors, "
        f"{len(ingested_posts)} ingested posts tracked"
    )

    # Run initial ingestion synchronously on startup (before scheduler)
    try:
        logger.info("Running initial auto-ingestion on startup...")
        auto_ingest_job()
        store.save()
        persist_ingested()
        logger.info("Initial ingestion and persistence complete")
    except Exception as e:
        logger.warning(f"Initial auto-ingestion failed: {e}")

    # Start periodic auto-ingestion (every 15 minutes)
    scheduler.add_job(
        auto_ingest_job,
        "interval",
        minutes=15,
        id="auto_ingest",
        name="Auto-ingest recent posts",
        replace_existing=True
    )
    scheduler.start()
    logger.info("Scheduler started with auto-ingest every 15 minutes")

    yield

    logger.info("Shutting down AI Assistant Service...")
    scheduler.shutdown(wait=False)
    # Persist state on shutdown
    try:
        store.save()
        persist_ingested()
        logger.info("State persisted on shutdown")
    except Exception as e:
        logger.warning(f"Failed to persist state on shutdown: {e}")


app = FastAPI(lifespan=lifespan)

# CORS — allow all origins for development (Expo web, Android emulator, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    question: str
    postId: int | None = None
    type: str | None = None
    tags: list[str] = []
    top_k: int = 10  # Increased from 5 to 10 for better recall


class TranslateRequest(BaseModel):
    text: str
    source_lang: str = "auto"
    target_lang: str = "en"


@app.post("/translate")
def translate(req: TranslateRequest):
    """
    Translate text using the LLM.
    """
    result = translate_text(
        text=req.text,
        source_lang=req.source_lang,
        target_lang=req.target_lang
    )
    return {"translatedText": result}


@app.post("/ingest/post/{post_id}")
def ingest_single_post(post_id: int):

    if post_id in ingested_posts:
        return {
            "status": "ALREADY_INGESTED",
            "postId": post_id
        }

    chunks_added = ingest_post(store, post_id)

    if chunks_added <= 0:
        return {
            "status": "FAILED",
            "postId": post_id,
            "error": "No text chunks were added"
        }

    ingested_posts.add(post_id)
    persist_ingested()

    return {
        "status": "INGESTED",
        "postId": post_id,
        "chunks": chunks_added
    }


@app.post("/news-brief")
def news_brief(
    user_id: str = Header(default="android-app-anonymous", alias="X-User-Id"),
    generate_summary: bool = Header(default=True, alias="X-Generate-Summary"),
):
    """
    Generate a news brief for the user — like hourly news highlights on TV.
    
    - Fetches recent posts (≤12 hours)
    - Scores them based on user preferences, recency, and importance
    - Dynamically determines how many to include
    - Optionally generates an LLM-powered brief summary
    
    Query params:
      user_id: the user's ID (default: anonymous)
      generate_summary: whether to generate an LLM summary (default: true)
    """
    logger.info(f"News brief requested for user={user_id}")

    # Build the brief data (scored posts)
    brief_data = build_news_brief(user_id=user_id)

    if brief_data["status"] != "SUCCESS":
        return brief_data

    # Generate LLM summary if requested
    if generate_summary and brief_data.get("posts"):
        try:
            brief_text = generate_news_brief(brief_data["posts"])
            brief_data["brief"] = brief_text
        except Exception as e:
            logger.error(f"Failed to generate brief summary: {e}")
            brief_data["brief"] = None
            brief_data["briefError"] = str(e)

    return brief_data


@app.post("/query")
def query(req: QueryRequest, authorization: str = Header(None)):

    intent = route_request(req.dict())

    # -------------------------
    # CASE 1: POST SUMMARY
    # -------------------------
    if intent == "POST_SUMMARY":
        if not req.postId:
            return {
                "answer": "I can only summarize if a post is selected.",
                "sources": []
            }

        return {
            "answer": summarize_post(fetch_post_content, req.postId),
            "sources": [{"postId": req.postId}]
        }

    # -------------------------
    # CASE 2: POST Q&A
    # -------------------------
    if intent == "POST_QA":
        if not req.postId:
            return {
                "answer": "I can only answer post questions if a post is selected.",
                "sources": []
            }

        content = fetch_post_content(req.postId)
        text = merge_paragraphs(content)

        answer = generate(req.question, [{
            "postId": req.postId,
            "text": text
        }])

        return {"answer": answer, "sources": [{"postId": req.postId}]}

    # -------------------------
    # CASE 3: TOPIC SEARCH / GENERAL RAG
    # -------------------------
    results = topic_search(
        store=store,
        question=req.question,
        tags=req.tags,
        top_k=req.top_k,
        ingested_posts=ingested_posts
    )

    if not results:
        return {
            "answer": "I don't have enough information.",
            "sources": []
        }

    answer = generate(req.question, results)

    return {"answer": answer, "sources": results}