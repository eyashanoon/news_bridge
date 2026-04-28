from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi.middleware.cors import CORSMiddleware
from ingestion.embedder import embed_text
from retrieval.vector_store import VectorStore
from retrieval.search import retrieve_relevant_chunks
from llm.generator import generate_answer
from scheduler.jobs import ingest_by_tags
from ingestion.fetcher import fetch_post_content
from ingestion.processor import merge_paragraphs, chunk_text


app = FastAPI(title="AI News Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# We initialize store after we know embedding dimension
dummy = embed_text("test")
store = VectorStore(dim=len(dummy))

scheduler = BackgroundScheduler()
scheduler.start()


class QueryRequest(BaseModel):
    question: str
    tags: list[str] = []
    top_k: int = 5


class IngestRequest(BaseModel):
    tags: list[str]


@app.post("/ingest")
def ingest(req: IngestRequest, authorization: str = Header(None)):
    if authorization is None:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    # For MVP, we just require the header exists
    ingest_by_tags(store, req.tags)
    return {"status": "ok", "message": "Ingestion completed"}


@app.post("/query")
def query(req: QueryRequest):
    if not req.question.strip():
        raise HTTPException(status_code=400, detail="Question is required")

    results = retrieve_relevant_chunks(store, req.question, top_k=req.top_k)
    results = rerank(req.question, results)
    # Optional filtering if tags were provided
    #if req.tags:
     #   results = [r for r in results if r["tag"] in req.tags]

    if not results:
        return {"answer": "I don't have enough information.", "sources": []}

    answer = generate_answer(req.question, results)

    print("QUESTION:", req.question)
    print("RESULTS:", len(results))
    print(results[:2])

    return {
        "answer": answer,
        "sources": results
    }


@app.on_event("startup")
def setup_periodic_ingestion():
    # Every 10 minutes example
    scheduler.add_job(
        func=lambda: ingest_by_tags(store, ["Iran", "USA"]),
        trigger="interval",
        minutes=10
    )
    print("FAISS SIZE:", store.index.ntotal)

@app.post("/ingest/post/{post_id}")
def ingest_post(post_id: int):
    content_json = fetch_post_content(post_id)

    full_text = merge_paragraphs(content_json)
    if not full_text.strip():
        return {"status": "empty", "message": "No content found"}

    chunks = chunk_text(full_text)

    for chunk in chunks:
        emb = embed_text(chunk)

        store.add(emb, {
            "postId": post_id,
            "tag": "direct",
            "timestamp": "manual",
            "text": chunk
        })

    store.save()

    return {"status": "ok", "chunks": len(chunks)}


@app.post("/summarize/post/{post_id}")
def summarize_post(post_id: int):
    content = fetch_post_content(post_id)
    text = merge_paragraphs(content)

    prompt = f"""
Summarize the following news article clearly and concisely:

{text}

Summary:
"""

    res = requests.post(f"{OLLAMA_URL}/api/generate", json={
        "model": LLM_MODEL,
        "prompt": prompt,
        "stream": False
    })

    res.raise_for_status()

    return {
        "answer": res.json()["response"].strip(),
        "sources": [{"postId": post_id}]
    }

def rerank(question, results):
    # simple version (no ML model yet)
    scored = []

    q_words = set(question.lower().split())

    for r in results:
        text = r["text"].lower()
        score = sum(1 for w in q_words if w in text)
        scored.append((score, r))

    scored.sort(reverse=True, key=lambda x: x[0])
    return [r for _, r in scored]