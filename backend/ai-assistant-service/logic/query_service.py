"""Query service — handles /query endpoint logic.

Multi-stage retrieval pipeline:
1. Extract tags from the question using the LLM
2. Fetch candidate posts by those tags from the backend
3. Fall back to category feeds if tags return nothing
4. Ingest candidates into the local vector store
5. Perform vector similarity search for the most relevant chunks
6. Feed context to the LLM for a natural-language answer
"""

import logging
from typing import Optional

from config import settings
from core.llm import LLM
from core.embedder import Embedder
from rag.store import VectorStore
from rag.ingest import Ingester
from logic.backend_client import BackendClient
from logic.language_utils import normalize_language, response_language_instruction
from logic.router import classify_query, QueryIntent

logger = logging.getLogger(__name__)

# Prompt used to extract search tags from a user question
# Tags should be short, individual keywords (single words or 2-word proper nouns) that
# would match how a news article is actually tagged in a database (e.g. "Israel", "Iran",
# "Gaza", "war", "conflict", "election", "Netanyahu"). Avoid compound phrases like
# "Israel-Iran conflict" — instead extract "Israel", "Iran", "conflict" separately.
TAG_EXTRACT_PROMPT = (
    "Extract 2-8 short search keywords from the following news question. "
    "Each tag must be a single word or a short proper noun (2 words max). "
    "Do NOT use compound phrases or multi-word descriptions. "
    "Tags are stored in a bilingual news database (Arabic and English). "
    "For each concept, include BOTH Arabic and English forms when applicable "
    "(e.g. Israel/إسرائيل, Iran/إيران, Gaza/غزة, elections/انتخابات). "
    "Return only the tags as a comma-separated list, nothing else.\n\n"
    "Example 1:\nQuestion: What's happening between Israel and Iran?\nTags: Israel, Iran, إسرائيل, إيران\n\n"
    "Example 2:\nQuestion: ما آخر أخبار غزة؟\nTags: Gaza, غزة, Palestine, فلسطين\n\n"
    "Example 3:\nQuestion: Technology developments in AI\nTags: technology, AI, تكنولوجيا\n\n"
    "Question: {query}"
)


class QueryService:
    """Orchestrates the full /query pipeline."""

    def __init__(
        self,
        llm: LLM,
        embedder: Embedder,
        vector_store: VectorStore,
        ingester: Ingester,
        backend: BackendClient,
    ) -> None:
        self.llm = llm
        self.embedder = embedder
        self.store = vector_store
        self.ingester = ingester
        self.backend = backend
        self.top_k = settings.default_top_k
        self.fallback_top_k = settings.fallback_top_k

    async def answer(
        self,
        query: str,
        post_id: Optional[int] = None,
        language: Optional[str] = None,
        hint_tags: Optional[list] = None,
    ) -> str:
        """Process a user query and return a natural-language answer.

        Args:
            query: The user's question text.
            post_id: If provided, the query is about this specific post (bypassed text extraction).
            language: Preferred response language ('english' or 'arabic').
            hint_tags: Tags from the selected post context (merged into tag search).
        """
        response_lang = normalize_language(language, query)
        logger.info(
            "QUERY received: '%s' (post_id=%s, language=%s)",
            query, post_id, response_lang,
        )
        intent, ref = classify_query(query)
        logger.info("QUERY intent: %s, ref: %s", intent.value, ref)

        # If a post_id was explicitly provided by the frontend, use it directly
        if post_id is not None:
            return await self._handle_post_query(query, str(post_id), intent, response_lang)

        if intent in (QueryIntent.POST_SUMMARY, QueryIntent.POST_QA):
            return await self._handle_post_query(query, ref, intent, response_lang)
        return await self._handle_topic_search(query, response_lang, hint_tags or [])

    # ------------------------------------------------------------------
    # Post-specific queries
    # ------------------------------------------------------------------

    async def _handle_post_query(
        self, query: str, post_ref: str, intent: QueryIntent, language: str
    ) -> str:
        """Answer a query about a specific post.

        Uses the full post content directly from the backend as context,
        bypassing the vector store/RAG entirely.
        """
        if not post_ref:
            return (
                "I need a post ID or article reference to answer that. "
                "Please specify which article you're asking about."
            )

        try:
            post_id = int(post_ref)
        except ValueError:
            return "I couldn't understand the post reference. Please provide a numeric post ID."

        # Fetch the full post content directly from the backend (no RAG)
        content = await self.backend.get_post_content(post_id)
        if not content or not content.get("content"):
            return "I couldn't find any content for that post."

        title = content.get("title", "")
        body = content.get("content", "")
        article_url = ""
        meta = await self.backend.get_post_by_id(post_id)
        if meta:
            article_url = meta.get("articleUrl") or ""

        # Use the full text as context (no chunking, no embedding search)
        full_text = f"{title}\n\n{body}" if title else body

        if intent == QueryIntent.POST_SUMMARY:
            prompt = (
                f"Summarize the following article content concisely.\n\n"
                f"Article content:\n{full_text}\n\n"
                f"Provide a brief summary highlighting the key points."
            )
        else:
            prompt = (
                f"Answer the following question based on the article content provided.\n\n"
                f"Question: {query}\n\n"
                f"Article content:\n{full_text}\n\n"
                f"Answer concisely and cite the article title."
            )

        return self.llm.generate(prompt)

    # ------------------------------------------------------------------
    # Topic search (general Q&A)
    # ------------------------------------------------------------------

    async def _handle_topic_search(
        self, query: str, language: str, hint_tags: list
    ) -> str:
        """Answer a general topic question via multi-stage retrieval."""
        # Step 0: Clear the vector store on every query so only fresh posts are used
        self.store.clear()
        logger.info("Vector store cleared (%d vectors removed)", self.store.size)

        # Step 1: Extract tags via LLM and merge with any tags from post context
        tags = await self._extract_tags(query)
        if hint_tags:
            tags = self._merge_tags(tags, hint_tags)
        logger.info("Extracted tags for '%s': %s", query, tags)

        # Step 2: Fetch candidate posts
        candidates = await self._fetch_candidates(tags, query)
        logger.info("TOPIC SEARCH candidates: %d posts", len(candidates))

        if not candidates:
            # Step 3: Fallback — try broader vector search
            logger.info("No candidates found, using fallback search")
            return await self._fallback_search(query, language)

        # Step 4: Ingest candidates into the vector store
        # Support both "postId" (PostByTagResponse) and "id" (FeedPostDTO) field names
        ingested_ids = set()
        for post in candidates:
            pid = post.get("postId") or post.get("id")
            if pid and str(pid) not in self.store.get_post_ids():
                if await self.ingester.ingest_post(pid):
                    ingested_ids.add(str(pid))
            elif pid:
                ingested_ids.add(str(pid))

        # Step 5: Build context directly from the candidate posts' vector store chunks
        # This ensures we answer based on the posts that matched our tags, not old stale vectors
        query_vec = self.embedder.embed(query)

        # Search with a broader top_k to get more candidate chunks
        all_results = self.store.search(query_vec, top_k=self.fallback_top_k)

        # Filter results to only include chunks from candidate posts
        filtered = [(score, meta) for score, meta in all_results
                     if meta.get("postId") in ingested_ids]

        results = filtered[:self.top_k] if filtered else all_results[:self.top_k]

        if not results:
            return await self._fallback_search(query, language)

        # Step 6: Generate answer
        context = self._format_context(results)
        lang_instruction = response_language_instruction(language)
        prompt = (
            f"Answer the following question based on the provided news context.\n\n"
            f"Question: {query}\n\n"
            f"News context:\n{context}\n\n"
            f"Provide a concise, informative answer.\n\n"
            f"{lang_instruction}"
        )
        answer = self.llm.generate(prompt)

        # Step 7: Append references (titles and links) from the source posts
        references = self._format_references(results)
        if references:
            answer += "\n\n" + references

        return answer

    async def _extract_tags(self, query: str) -> list:
        """Use the LLM to extract search tags from the query."""
        try:
            prompt = TAG_EXTRACT_PROMPT.format(query=query)
            logger.info("TAG EXTRACTION prompt: '%s'", prompt[:300])
            result = self.llm.generate(prompt, temperature=0.0).strip()
            tags = [t.strip() for t in result.split(",") if t.strip()]
            logger.info("TAG EXTRACTION result: %s", tags)
            # Safety net: split any remaining compound/multi-word tags into individual words
            # Database tags are single keywords (NER/YAKE output), so we expand compound
            # phrases like "Israel-Iran" into ["Israel", "Iran"]
            expanded = []
            for tag in tags:
                # Split on hyphens, slashes, or spaces for multi-word tags
                parts = [p.strip(",.;:!?") for p in tag.replace("-", " ").replace("/", " ").split()]
                for part in parts:
                    if part and part not in expanded:
                        expanded.append(part)
            logger.info("TAG EXTRACTION expanded: %s", expanded)
            return expanded[:8]  # limit to 8 tags (bilingual pairs need more slots)
        except Exception as e:
            logger.warning("Tag extraction failed: %s", e)
            # Fallback: use the first 3 words as tags
            words = query.lower().split()[:3]
            return [w.strip(",.;:!?") for w in words if w.strip(",.;:!?")]

    async def _fetch_candidates(self, tags: list, query: str) -> list:
        """Fetch candidate posts matching tags, with text and category fallbacks."""
        candidates = []

        # Step 1: Tag-based search (most recent posts matching any tag)
        if tags:
            candidates = await self.backend.search_posts_by_tags(tags, limit=self.top_k)
            logger.info("Tag search with %d tags returned %d posts", len(tags), len(candidates))

        # Step 2: Full-text search using tag keywords
        if not candidates and tags:
            search_query = " ".join(tags[:4])
            logger.info("Tag search empty, trying text search: %s", search_query)
            text_results = await self.backend.search_posts_by_query(search_query)
            candidates = text_results[: self.top_k]

        # Step 3: Full-text search using the original question
        if not candidates:
            logger.info("Text search empty, trying query text search")
            text_results = await self.backend.search_posts_by_query(query)
            candidates = text_results[: self.top_k]

        # Step 4: Category-based fallback
        if not candidates:
            category = self._infer_category(query)
            if category:
                logger.info("No text results, trying category search: %s", category)
                candidates = await self.backend.get_posts_by_category(category)

        return candidates

    @staticmethod
    def _merge_tags(extracted: list, hint_tags: list) -> list:
        """Merge LLM-extracted tags with tags from post context, preserving order."""
        merged = []
        seen = set()
        for tag in list(extracted) + list(hint_tags):
            if not tag:
                continue
            key = tag.strip().lower()
            if key and key not in seen:
                seen.add(key)
                merged.append(tag.strip())
        return merged[:8]

    def _infer_category(self, query: str) -> Optional[str]:
        """Naively infer a news category from the query text."""
        q = query.lower()
        category_map = {
            "politics": ["politics", "government", "election", "president", "parliament"],
            "world": ["world", "international", "global", "foreign"],
            "technology": ["tech", "technology", "ai", "software", "digital"],
            "business": ["business", "economy", "market", "finance", "stock"],
            "sports": ["sports", "football", "basketball", "match", "game"],
            "health": ["health", "medical", "disease", "covid", "hospital"],
            "science": ["science", "research", "space", "climate", "environment"],
        }
        for cat, keywords in category_map.items():
            if any(kw in q for kw in keywords):
                return cat
        return None

    async def _fallback_search(self, query: str, language: str) -> str:
        """Fallback: text search, then vector search, then a graceful no-info message."""
        logger.info("Using fallback search for query: %s", query)

        # Try backend full-text search before empty vector store
        text_results = await self.backend.search_posts_by_query(query)
        if text_results:
            ingested_ids = set()
            for post in text_results[: self.top_k]:
                pid = post.get("id")
                if pid and str(pid) not in self.store.get_post_ids():
                    if await self.ingester.ingest_post(pid):
                        ingested_ids.add(str(pid))
                elif pid:
                    ingested_ids.add(str(pid))

            if ingested_ids:
                query_vec = self.embedder.embed(query)
                all_results = self.store.search(query_vec, top_k=self.fallback_top_k)
                filtered = [
                    (score, meta) for score, meta in all_results
                    if meta.get("postId") in ingested_ids
                ]
                results = filtered[: self.top_k] if filtered else all_results[: self.top_k]
                if results:
                    context = self._format_context(results)
                    lang_instruction = response_language_instruction(language)
                    prompt = (
                        f"Answer the following question based on the provided news context.\n\n"
                        f"Question: {query}\n\n"
                        f"News context:\n{context}\n\n"
                        f"Provide a concise answer.\n\n"
                        f"{lang_instruction}"
                    )
                    return self.llm.generate(prompt)

        # Broader vector search on any remaining indexed content
        query_vec = self.embedder.embed(query)
        results = self.store.search(query_vec, top_k=self.fallback_top_k)

        if results:
            context = self._format_context(results)
            lang_instruction = response_language_instruction(language)
            prompt = (
                f"Answer the following question based on the provided news context.\n\n"
                f"Question: {query}\n\n"
                f"News context:\n{context}\n\n"
                f"Provide a concise answer.\n\n"
                f"{lang_instruction}"
            )
            return self.llm.generate(prompt)

        if language == "arabic":
            return (
                "لا تتوفر لدي معلومات كافية للإجابة على هذا السؤال حالياً. "
                "يرجى إعادة صياغة سؤالك أو السؤال عن موضوع آخر."
            )
        return (
            "I don't have enough information to answer that question right now. "
            "Please try rephrasing your query or asking about a different topic."
        )

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _format_context(results: list) -> str:
        """Format search results into a context string for the LLM."""
        parts = []
        seen_titles = set()
        for score, meta in results:
            title = meta.get("title", "Untitled")
            text = meta.get("text", "")
            if title not in seen_titles:
                parts.append(f"[Article: {title}]\n{text}")
                seen_titles.add(title)
        return "\n\n".join(parts)

    @staticmethod
    def _format_references(results: list) -> str:
        """Format source references (titles and clickable links) from search results."""
        seen = {}
        for score, meta in results:
            post_id = meta.get("postId", "")
            if post_id in seen:
                continue
            title = meta.get("title", "Untitled")
            url = meta.get("articleUrl", "")
            if url:
                seen[post_id] = (title, url)
            elif title != "Untitled":
                seen[post_id] = (title, "")

        if not seen:
            return ""

        lines = ["**References:**"]
        for post_id in seen:
            title, url = seen[post_id]
            if url:
                # Plain text: title on one line, URL on next line for easy clicking
                lines.append(f"- {title}")
                lines.append(f"  {url}")
            else:
                lines.append(f"- {title} (ID: {post_id})")
        return "\n".join(lines)
