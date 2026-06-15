package com.example.newscrawler.repository;

import com.example.newscrawler.entity.TelegramCrawlLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface TelegramCrawlLogRepository extends JpaRepository<TelegramCrawlLog, Long> {

    Page<TelegramCrawlLog> findByChannel_IdOrderByStartedAtDesc(Long channelId, Pageable pageable);

    @Query("SELECT COUNT(l) FROM TelegramCrawlLog l WHERE l.channel.id = :channelId AND l.status = com.example.newscrawler.entity.TelegramCrawlLog$CrawlStatus.SUCCESS")
    long countSuccessfulByChannelId(@Param("channelId") Long channelId);

    @Query("SELECT COUNT(l) FROM TelegramCrawlLog l WHERE l.channel.id = :channelId AND l.status = com.example.newscrawler.entity.TelegramCrawlLog$CrawlStatus.FAILED")
    long countFailedByChannelId(@Param("channelId") Long channelId);

    @Query("SELECT AVG(l.durationMs) FROM TelegramCrawlLog l WHERE l.channel.id = :channelId AND l.durationMs IS NOT NULL")
    Double avgDurationMsByChannelId(@Param("channelId") Long channelId);

    @Query("SELECT AVG(l.postsCreated) FROM TelegramCrawlLog l WHERE l.channel.id = :channelId")
    Double avgPostsCreatedByChannelId(@Param("channelId") Long channelId);

    @Query("SELECT l.status, COUNT(l) FROM TelegramCrawlLog l WHERE l.startedAt >= :since GROUP BY l.status")
    List<Object[]> aggregateStatusSince(@Param("since") Instant since);

    @Query("SELECT AVG(l.durationMs) FROM TelegramCrawlLog l WHERE l.startedAt >= :since AND l.durationMs IS NOT NULL")
    Double avgDurationMsSince(@Param("since") Instant since);

    @Query("SELECT AVG(l.postsCreated) FROM TelegramCrawlLog l WHERE l.startedAt >= :since")
    Double avgPostsCreatedSince(@Param("since") Instant since);
}
