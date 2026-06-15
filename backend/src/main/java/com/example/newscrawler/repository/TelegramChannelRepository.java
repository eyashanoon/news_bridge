package com.example.newscrawler.repository;

import com.example.newscrawler.entity.RecordStatus;
import com.example.newscrawler.entity.TelegramChannel;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface TelegramChannelRepository extends JpaRepository<TelegramChannel, Long> {
    Optional<TelegramChannel> findByChannelUsername(String channelUsername);
    List<TelegramChannel> findByStatus(RecordStatus status);
    boolean existsByChannelUsername(String channelUsername);

    @Query("SELECT c FROM TelegramChannel c WHERE c.status = com.example.newscrawler.entity.RecordStatus.ACTIVE " +
           "AND (LOWER(c.channelUsername) LIKE LOWER(CONCAT('%', :q, '%')) " +
           "OR LOWER(c.displayName) LIKE LOWER(CONCAT('%', :q, '%'))) " +
           "ORDER BY c.displayName")
    List<TelegramChannel> searchActiveByName(@Param("q") String q);

    long countByStatus(RecordStatus status);

    @Query("SELECT COUNT(c) FROM TelegramChannel c WHERE c.createdAt >= :since")
    long countCreatedSince(@Param("since") Instant since);

    @Query("SELECT c FROM TelegramChannel c WHERE " +
           "(:status IS NULL OR c.status = :status) AND " +
           "(:q IS NULL OR :q = '' OR LOWER(c.channelUsername) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
           "LOWER(c.displayName) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
           "LOWER(COALESCE(c.description, '')) LIKE LOWER(CONCAT('%', :q, '%')))")
    Page<TelegramChannel> searchAdmin(@Param("q") String q, @Param("status") RecordStatus status, Pageable pageable);
}
