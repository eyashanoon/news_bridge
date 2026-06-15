package com.example.newscrawler.repository;

import com.example.newscrawler.entity.AdminActivityAction;
import com.example.newscrawler.entity.AdminActivityLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface AdminActivityLogRepository extends JpaRepository<AdminActivityLog, Long> {

    @Query("""
            SELECT l FROM AdminActivityLog l
            WHERE (:search IS NULL OR :search = '' OR
                   LOWER(l.adminEmail) LIKE LOWER(CONCAT('%', :search, '%')) OR
                   LOWER(l.targetResource) LIKE LOWER(CONCAT('%', :search, '%')) OR
                   LOWER(l.result) LIKE LOWER(CONCAT('%', :search, '%')))
            AND (:action IS NULL OR l.action = :action)
            AND (:status IS NULL OR :status = '' OR l.status = :status)
            AND (:adminEmail IS NULL OR :adminEmail = '' OR LOWER(l.adminEmail) = LOWER(:adminEmail))
            AND (:from IS NULL OR l.timestamp >= :from)
            AND (:to IS NULL OR l.timestamp <= :to)
            """)
    Page<AdminActivityLog> search(
            @Param("search") String search,
            @Param("action") AdminActivityAction action,
            @Param("status") String status,
            @Param("adminEmail") String adminEmail,
            @Param("from") Instant from,
            @Param("to") Instant to,
            Pageable pageable
    );

    List<AdminActivityLog> findByTimestampAfterOrderByTimestampDesc(Instant since);

    long countByAdminEmailAndTimestampAfter(String adminEmail, Instant since);

    @Query("SELECT COUNT(DISTINCT l.adminEmail) FROM AdminActivityLog l WHERE l.timestamp >= :since")
    long countDistinctAdminsSince(@Param("since") Instant since);

    @Query("SELECT COUNT(l) FROM AdminActivityLog l WHERE l.timestamp >= :since AND l.status = :status")
    long countByStatusSince(@Param("since") Instant since, @Param("status") String status);

    List<AdminActivityLog> findByTargetResourceContainingOrderByTimestampDesc(String targetResource);
}
