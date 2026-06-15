package com.example.newscrawler.repository;

import com.example.newscrawler.entity.TelegramPost;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface TelegramPostRepository extends JpaRepository<TelegramPost, Long> {
    List<TelegramPost> findByChannel_IdOrderByMessageDateDesc(Long channelId);
    Page<TelegramPost> findByChannel_Id(Long channelId, Pageable pageable);
    Page<TelegramPost> findAllByOrderByMessageDateDesc(Pageable pageable);
    boolean existsByChannel_IdAndTelegramMessageId(Long channelId, Long telegramMessageId);
    long countByChannel_Id(Long channelId);

    long countByChannel_IdAndTagsExtractedFalse(Long channelId);

    @Query("SELECT p FROM TelegramPost p JOIN p.channel c WHERE c.status = com.example.newscrawler.entity.RecordStatus.ACTIVE " +
           "AND p.content IS NOT NULL AND LOWER(p.content) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "ORDER BY p.messageDate DESC")
    List<TelegramPost> searchActiveByContent(@Param("q") String q, Pageable pageable);

    @Query("SELECT p FROM TelegramPost p JOIN p.channel c WHERE c.status = com.example.newscrawler.entity.RecordStatus.ACTIVE " +
           "ORDER BY p.messageDate DESC")
    Page<TelegramPost> findActiveChannelPosts(Pageable pageable);

    @Query("SELECT p FROM TelegramPost p WHERE p.tagsExtracted = false AND p.content IS NOT NULL AND LENGTH(TRIM(p.content)) > 0")
    List<TelegramPost> findUntagged(Pageable pageable);

    long countByTagsExtracted(boolean tagsExtracted);

    @Query("SELECT COUNT(p) FROM TelegramPost p WHERE p.messageDate >= :since OR p.collectedAt >= :since")
    long countSince(@Param("since") Instant since);

    @Query(value = "SELECT DATE(COALESCE(message_date, collected_at)) AS d, COUNT(*) FROM telegram_posts " +
           "WHERE COALESCE(message_date, collected_at) >= :since GROUP BY d ORDER BY d", nativeQuery = true)
    List<Object[]> countPostsPerDaySince(@Param("since") Instant since);

    @Query("SELECT p.channel.id, COUNT(p) FROM TelegramPost p WHERE COALESCE(p.messageDate, p.collectedAt) >= :since GROUP BY p.channel.id ORDER BY COUNT(p) DESC")
    List<Object[]> topChannelsByPostsSince(@Param("since") Instant since, Pageable pageable);

    @Query("SELECT p.channel.id, AVG(p.viewCount) FROM TelegramPost p WHERE p.viewCount > 0 GROUP BY p.channel.id ORDER BY AVG(p.viewCount) DESC")
    List<Object[]> topChannelsByAvgViews(Pageable pageable);

    @Query("SELECT p FROM TelegramPost p WHERE " +
           "(:channelId IS NULL OR p.channel.id = :channelId) AND " +
           "(:mediaType IS NULL OR :mediaType = '' OR p.mediaType = :mediaType) AND " +
           "(:dateFrom IS NULL OR COALESCE(p.messageDate, p.collectedAt) >= :dateFrom) AND " +
           "(:dateTo IS NULL OR COALESCE(p.messageDate, p.collectedAt) <= :dateTo) AND " +
           "(:q IS NULL OR :q = '' OR LOWER(COALESCE(p.content, '')) LIKE LOWER(CONCAT('%', :q, '%')))")
    Page<TelegramPost> searchAdmin(@Param("q") String q,
                                   @Param("channelId") Long channelId,
                                   @Param("mediaType") String mediaType,
                                   @Param("dateFrom") Instant dateFrom,
                                   @Param("dateTo") Instant dateTo,
                                   Pageable pageable);
}
