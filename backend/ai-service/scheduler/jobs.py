from ingestion.fetcher import fetch_posts_by_tags, fetch_post_content
from ingestion.processor import merge_paragraphs, chunk_text
from ingestion.embedder import embed_text
from retrieval.vector_store import VectorStore


def ingest_by_tags(store: VectorStore, tags: list[str]):
    posts = fetch_posts_by_tags(tags)

    for post in posts:
        post_id = post["postId"]
        tag = post["tag"]
        timestamp = post["timestamp"]

        content_json = fetch_post_content(post_id)
        full_text = merge_paragraphs(content_json)
        chunks = chunk_text(full_text)

        for chunk in chunks:
            emb = embed_text(chunk)

            store.add(emb, {
                "postId": post_id,
                "tag": tag,
                "timestamp": timestamp,
                "text": chunk
            })

    store.save()
