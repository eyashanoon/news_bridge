"""AI Assistant Service — FastAPI application.

Provides AI-powered capabilities:
- /query — Conversational Q&A & search
- /news-brief — AI-generated news highlights
- /translate — Text translation via LLM
- /ingest/post/{post_id} — On-demand ingestion into vector store

Backward-compatible with the old API contract (question/postId/tags/top_k format,
translatedText response field, news-brief header-based auth, etc.).
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List

from config import settings
from core.llm import LLM
from core.embedder import Embedder
from rag.store import VectorStore
from rag.ingest import Ingester
from rag.scheduler import IngestionScheduler
from logic.backend_client import BackendClient
from logic.query_service import QueryService
from logic.news_brief_service import NewsBriefService
from logic.translate_service import TranslateService

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Singleton services (initialised at startup)
# ---------------------------------------------------------------------------

llm: LLM = None
embedder: Embedder = None
vector_store: VectorStore = None
backend_client: BackendClient = None
ingester: Ingester = None
scheduler: IngestionScheduler = None
query_service: QueryService = None
news_brief_service: NewsBriefService = None
translate_service: TranslateService = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    global llm, embedder, vector_store, backend_client
    global ingester, scheduler, query_service, news_brief_service, translate_service

    logger.info("Starting AI Assistant Service...")

    # Initialise core components
    llm = LLM()
    embedder = Embedder()
    vector_store = VectorStore()
    backend_client = BackendClient()

    # Initialise ingestion pipeline
    ingester = Ingester(vector_store, embedder, backend_client)

    # Initialise services
    query_service = QueryService(llm, embedder, vector_store, ingester, backend_client)
    news_brief_service = NewsBriefService(llm, backend_client)
    translate_service = TranslateService(llm)

    # Start auto-ingestion scheduler
    scheduler = IngestionScheduler(ingester)
    await scheduler.start()

    logger.info(
        "AI Assistant Service ready — %d vectors in store",
        vector_store.size,
    )

    yield  # Application runs here

    # Shutdown
    logger.info("Shutting down AI Assistant Service...")
    scheduler.stop()
    await backend_client.close()


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan,
)

# Allow cross-origin requests from the news-feed frontend (port 5174) and
# any other local dev frontends. In production, restrict to known origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class QueryRequest(BaseModel):
    """Backward-compatible query request — accepts both 'query' and 'question' fields."""
    query: Optional[str] = None
    question: Optional[str] = None
    postId: Optional[int] = None
    tags: list[str] = []
    language: Optional[str] = None
    top_k: int = 5


class QueryResponse(BaseModel):
    answer: str
    intent: Optional[str] = None
    sources: Optional[list] = None


class NewsBriefRequest(BaseModel):
    user_id: Optional[str] = Field(None, description="User ID for personalised preferences")
    language: str = Field("english", description="Response language: 'english' or 'arabic'")
    max_posts: int = Field(12, ge=1, le=50)
    min_posts: int = Field(5, ge=1, le=50)


class TranslateRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Text to translate")
    target_lang: Optional[str] = Field(None, description="Target language, e.g. 'english', 'arabic'")
    source_lang: Optional[str] = Field(None, description="Source language if known")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "ok",
        "vectors_in_store": vector_store.size if vector_store else 0,
        "llm_available": llm.is_available() if llm else False,
    }


@app.post("/query")
async def query_endpoint(req: QueryRequest):
    """Conversational Q&A and search endpoint.

    Accepts both new-style ({"query": "..."}) and old-style
    ({"question": "...", "postId": ..., "tags": [...], "top_k": ...}) requests.

    Returns answer text and optionally a sources list for backward compatibility.
    """
    if not query_service:
        raise HTTPException(status_code=503, detail="Service not ready")

    try:
        query_text = req.query or req.question or ""
        if not query_text:
            raise HTTPException(status_code=400, detail="Missing 'query' or 'question' field")

        from logic.router import classify_query
        from logic.language_utils import normalize_language

        intent, _ = classify_query(query_text)
        response_lang = normalize_language(req.language, query_text)
        # Pass postId/tags/language so post-specific and bilingual queries work correctly
        answer = await query_service.answer(
            query_text,
            post_id=req.postId,
            language=response_lang,
            hint_tags=req.tags or None,
        )

        # Build sources list for backward compatibility (post-specific queries)
        sources = []
        if req.postId:
            sources.append({"postId": req.postId})

        return QueryResponse(
            answer=answer,
            intent=intent.value,
            sources=sources,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Query failed")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/news-brief")
async def news_brief_endpoint(
    req: Optional[NewsBriefRequest] = None,
    # Backward-compat headers (old-style clients use headers instead of body)
    x_user_id: Optional[str] = Header(None, alias="X-User-Id"),
    x_language: Optional[str] = Header(None, alias="X-Language"),
):
    """Generate an AI news brief with top stories.

    Accepts both new-style (JSON body) and old-style (headers) requests.
    Returns both old and new response fields for compatibility.
    """
    if not news_brief_service:
        raise HTTPException(status_code=503, detail="Service not ready")

    try:
        # Merge parameters from body or headers (backward compat)
        if req and req.user_id:
            user_id = req.user_id
        else:
            user_id = x_user_id or None

        # Determine language: body > header > default
        language = "english"
        if req and req.language:
            language = req.language
        elif x_language:
            language = x_language

        # Map short codes used by old clients
        lang_map = {"en": "english", "ar": "arabic"}
        language = lang_map.get(language, language)

        result = await news_brief_service.generate_brief(
            user_id=user_id,
            language=language,
        )

        brief_text = result.get("brief_text", "")

        return {
            "status": "SUCCESS",
            "posts": result.get("posts", []),
            "brief": brief_text,
            "brief_text": brief_text,
            "average_score": result.get("average_score", 0.0),
            "total_candidates": result.get("total_candidates", 0),
            "selected_count": result.get("selected_count", 0),
        }
    except Exception as e:
        logger.exception("News brief generation failed")
        return {
            "status": "FAILED",
            "message": str(e),
            "posts": [],
            "brief": None,
            "brief_text": "",
        }


@app.post("/translate")
async def translate_endpoint(req: TranslateRequest):
    """Translate text between languages using the local LLM.

    Accepts both new-style ({"text": "...", "target_lang": "english"}) and
    old-style ({"text": "...", "source_lang": "auto", "target_lang": "en"}) requests.

    Returns translatedText for backward compatibility with old clients.
    """
    if not translate_service:
        raise HTTPException(status_code=503, detail="Service not ready")

    try:
        text = req.text
        target_lang = req.target_lang or "english"
        source_lang = req.source_lang

        # Map short language codes used by old clients
        lang_map = {"en": "english", "ar": "arabic", "auto": None}
        if target_lang in lang_map:
            target_lang = lang_map[target_lang] or "english"
        if source_lang and source_lang in lang_map:
            source_lang = lang_map[source_lang]

        translated = translate_service.translate(
            text=text,
            target_lang=target_lang,
            source_lang=source_lang,
        )

        return {
            "translatedText": translated,
            "translated_text": translated,
            "target_lang": target_lang,
            "source_lang": source_lang,
        }
    except Exception as e:
        logger.exception("Translation failed")
        return {
            "translatedText": text,
            "translated_text": text,
            "target_lang": req.target_lang or "english",
            "source_lang": req.source_lang,
        }


@app.post("/ingest/post/{post_id}")
async def ingest_post_endpoint(post_id: int):
    """Ingest a specific post into the vector store on demand.

    Returns both new-style and old-style response fields for compatibility.
    Legacy clients expect: {status: "INGESTED"|"FAILED", postId, chunks}
    """
    if not ingester:
        raise HTTPException(status_code=503, detail="Service not ready")

    try:
        success = await ingester.ingest_post(post_id)
        if success:
            return {
                "success": True,
                "status": "INGESTED",
                "postId": post_id,
                "chunks": 1,
                "message": f"Post {post_id} ingested successfully",
            }
        else:
            return {
                "success": False,
                "status": "FAILED",
                "postId": post_id,
                "chunks": 0,
                "message": f"Post {post_id} ingestion failed (no content or not found)",
            }
    except Exception as e:
        logger.exception("Ingestion failed for post %d", post_id)
        return {
            "success": False,
            "status": "FAILED",
            "postId": post_id,
            "chunks": 0,
            "message": str(e),
        }


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )