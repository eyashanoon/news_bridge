"""Ingestion pipeline: fetches post content, chunks, embeds, and stores."""

import logging
from typing import List, Dict, Optional

from config import settings
from core.embedder import Embedder
from rag.store import VectorStore
from logic.backend_client import BackendClient

logger = logging.getLogger(__name__)


class Ingester:
    """Handles chunking and ingestion of posts into the vector store."""

    def __init__(
        self,
        vector_store: VectorStore,
        embedder: Embedder,
        backend_client: BackendClient,
    ) -> None:
        self.store = vector_store
        self.embedder = embedder
        self.backend = backend_client
        self.chunk_size = settings.chunk_size
        self.chunk_overlap = settings.chunk_overlap

    # ------------------------------------------------------------------
    # Chunking
    # ------------------------------------------------------------------

    def _chunk_text(self, text: str) -> List[str]:
        """Split text into overlapping chunks of ~chunk_size characters."""
        if not text:
            return []

        chunks = []
        start = 0
        while start < len(text):
            end = start + self.chunk_size
            chunk = text[start:end]
            if chunk:
                chunks.append(chunk)
            start += self.chunk_size - self.chunk_overlap
            if start >= len(text):
                break
        return chunks

    # ------------------------------------------------------------------
    # Single-post ingestion
    # ------------------------------------------------------------------

    async def ingest_post(self, post_id: int) -> bool:
        """Fetch a post, chunk it, embed, and add to the vector store.

        Returns True if ingestion succeeded, False otherwise.
        """
        try:
            content = await self.backend.get_post_content(post_id)
            if not content or not content.get("content"):
                logger.warning("Post %d has no content, skipping", post_id)
                return False

            title = content.get("title", "")
            body = content.get("content", "")
            merged = f"{title}\n\n{body}" if title else body

            chunks = self._chunk_text(merged)
            if not chunks:
                return False

            # Embed all chunks
            vectors = self.embedder.embed_batch(chunks)

            # Fetch post metadata for articleUrl (from FeedPostDTO)
            meta = await self.backend.get_post_by_id(post_id)
            article_url = (meta.get("articleUrl") or "") if meta else ""

            # Build metadata for each chunk
            meta_list = []
            for chunk in chunks:
                meta_list.append({
                    "postId": str(post_id),
                    "title": title,
                    "articleUrl": article_url,
                    "text": chunk,
                })

            self.store.add(vectors, meta_list)
            logger.info(
                "Ingested post %d (%d chunks, %d total vectors, url: %s)",
                post_id, len(chunks), self.store.size, article_url,
            )
            return True

        except Exception as e:
            logger.error("Failed to ingest post %d: %s", post_id, e)
            return False

    # ------------------------------------------------------------------
    # Bulk ingestion of recent posts
    # ------------------------------------------------------------------

    async def ingest_recent_posts(self, hours: int = 24) -> int:
        """Fetch recent posts from the backend and ingest unseen ones.

        Args:
            hours: look-back window in hours.

        Returns:
            Number of newly ingested posts.
        """
        existing_ids = self.store.get_post_ids()
        posts = await self.backend.get_recent_posts(hours=hours)
        count = 0

        for post in posts:
            pid = post.get("id")
            if not pid:
                continue
            pid_str = str(pid)
            if pid_str in existing_ids:
                continue
            if await self.ingest_post(pid):
                count += 1
                existing_ids.add(pid_str)

        logger.info("Bulk ingestion complete: %d new posts", count)
        return count