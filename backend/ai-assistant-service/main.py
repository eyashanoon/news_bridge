from fastapi import FastAPI, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from router import route_request
from logic.post_logic import summarize_post
from logic.topic_logic import topic_search
from core.llm import generate

from ingestion.fetcher import fetch_post_content
from ingestion.processor import merge_paragraphs
from rag.ingest import ingest_post
from rag.global_store import store, ingested_posts


app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    question: str
    postId: int | None = None
    type: str | None = None
    tags: list[str] = []
    top_k: int = 5


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

    return {
        "status": "INGESTED",
        "postId": post_id,
        "chunks": chunks_added
    }


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