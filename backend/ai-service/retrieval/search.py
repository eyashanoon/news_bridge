from ingestion.embedder import embed_text
from retrieval.vector_store import VectorStore


def retrieve_relevant_chunks(store: VectorStore, question: str, top_k=5):
    q_emb = embed_text(question)
    results = store.search(q_emb, top_k=top_k)

    # deduplicate by (postId + text)
    seen = set()
    unique = []

    for r in results:
        key = (r["postId"], r["text"])
        if key not in seen:
            seen.add(key)
            unique.append(r)

    return unique
