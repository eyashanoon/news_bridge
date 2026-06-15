package com.example.newscrawler.repository;

import com.example.newscrawler.entity.TelegramEngagementEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface TelegramEngagementEventRepository extends JpaRepository<TelegramEngagementEvent, Long> {

    long countByChannelId(Long channelId);

    @Query("SELECT COUNT(DISTINCT e.userId) FROM TelegramEngagementEvent e WHERE e.channelId = :channelId AND e.userId IS NOT NULL")
    long countDistinctUsersByChannelId(@Param("channelId") Long channelId);

    long countByPostId(Long postId);

    long countByUserId(Long userId);

    List<TelegramEngagementEvent> findByCreatedAtAfter(Instant since);

    List<TelegramEngagementEvent> findByCreatedAtBetween(Instant start, Instant end);

    long countByCreatedAtAfter(Instant since);

    long countByEventTypeAndCreatedAtAfter(TelegramEngagementEvent.EventType eventType, Instant since);

    @Query("SELECT e.channelId, COUNT(e) FROM TelegramEngagementEvent e WHERE e.createdAt >= :since GROUP BY e.channelId ORDER BY COUNT(e) DESC")
    List<Object[]> topChannelsByViewsSince(@Param("since") Instant since, org.springframework.data.domain.Pageable pageable);

    @Query("SELECT COUNT(DISTINCT e.userId) FROM TelegramEngagementEvent e WHERE e.createdAt >= :since AND e.userId IS NOT NULL")
    long countDistinctUsersSince(@Param("since") Instant since);

    @Query("SELECT AVG(e.value) FROM TelegramEngagementEvent e WHERE e.eventType = com.example.newscrawler.entity.TelegramEngagementEvent$EventType.READ_TIME AND e.postId = :postId")
    Double avgReadTimeByPostId(@Param("postId") Long postId);

    @Query("SELECT AVG(e.value) FROM TelegramEngagementEvent e WHERE e.eventType = com.example.newscrawler.entity.TelegramEngagementEvent$EventType.READ_TIME AND e.channelId = :channelId")
    Double avgReadTimeByChannelId(@Param("channelId") Long channelId);

    @Query("SELECT e.feedScore FROM TelegramEngagementEvent e WHERE e.feedScore IS NOT NULL AND e.createdAt >= :since")
    List<Double> feedScoresSince(@Param("since") Instant since);

    @Query("SELECT e.channelId, COUNT(e) FROM TelegramEngagementEvent e WHERE e.createdAt >= :since GROUP BY e.channelId")
    List<Object[]> channelViewCountsBetween(@Param("since") Instant since);

    @Query("SELECT e.channelId, COUNT(e) FROM TelegramEngagementEvent e WHERE e.createdAt >= :before AND e.createdAt < :since GROUP BY e.channelId")
    List<Object[]> channelViewCountsBetweenRange(@Param("since") Instant since, @Param("before") Instant before);
}
