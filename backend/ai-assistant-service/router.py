def route_request(req: dict):
    question = req.get("question", "")
    post_id = req.get("postId")

    q = question.lower()

    # POST MODE
    if post_id:
        if any(x in q for x in ["summarize", "summary", "tl;dr", "explain", "what does this say", "لخص", "تلخيص"]):
            return "POST_SUMMARY"
        return "POST_QA"

    # TOPIC SEARCH
    if any(x in q for x in ["what is", "tell me about", "news about", "who is", "why", "latest", "updates", "what happened"]):
        return "TOPIC_SEARCH"

    return "GENERAL_RAG"