from core.embedder import embed


def search(store, question, top_k=5):
    if store is None:
        return []

    q_vec = embed(question)
    return store.search(q_vec, top_k)