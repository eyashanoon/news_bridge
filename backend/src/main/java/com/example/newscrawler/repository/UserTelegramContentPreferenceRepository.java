package com.example.newscrawler.repository;

import com.example.newscrawler.entity.UserTelegramContentPreference;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface UserTelegramContentPreferenceRepository extends JpaRepository<UserTelegramContentPreference, Long> {
    Optional<UserTelegramContentPreference> findByUser_Id(Long userId);

    @Query("SELECT COUNT(p) FROM UserTelegramContentPreference p WHERE p.updatedAt >= :since")
    long countActiveSince(@Param("since") Instant since);

    @Query("""
            SELECT COUNT(p) FROM UserTelegramContentPreference p
            WHERE p.contentTagVector IS NOT NULL
              AND p.contentTagVector <> '{}'
              AND p.contentTagVector <> ''
            """)
    long countWithLearnedPreferences();

    List<UserTelegramContentPreference> findAll();
}
