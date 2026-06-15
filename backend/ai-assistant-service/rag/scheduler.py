"""APScheduler-based auto-ingestion that runs every N minutes.

Continuously ingests new posts from the backend to keep the vector
store fresh without manual intervention.
"""

import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger

from config import settings

logger = logging.getLogger(__name__)


class IngestionScheduler:
    """Periodically ingests recent posts into the vector store."""

    def __init__(self, ingester) -> None:
        """
        Args:
            ingester: an instance of rag.ingest.Ingester.
        """
        self.ingester = ingester
        self.scheduler = AsyncIOScheduler()

    async def start(self) -> None:
        """Begin the scheduled ingestion loop."""
        interval = settings.auto_ingest_interval_minutes
        self.scheduler.add_job(
            self._run_ingestion,
            trigger=IntervalTrigger(minutes=interval),
            id="auto_ingest",
            replace_existing=True,
            max_instances=1,
        )
        self.scheduler.start()
        logger.info(
            "Ingestion scheduler started (every %d minutes)", interval
        )

        # Run an initial ingestion immediately
        await self._run_ingestion()

    def stop(self) -> None:
        """Gracefully shut down the scheduler."""
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            logger.info("Ingestion scheduler stopped")

    async def _run_ingestion(self) -> None:
        """Job that performs the actual ingestion."""
        try:
            count = await self.ingester.ingest_recent_posts(hours=24)
            if count:
                logger.info("Auto-ingestion: %d new posts ingested", count)
        except Exception as e:
            logger.error("Auto-ingestion failed: %s", e)
