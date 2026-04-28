from rag.store import VectorStore

store = VectorStore(dim=768)

# track ingested post ids
ingested_posts = set()