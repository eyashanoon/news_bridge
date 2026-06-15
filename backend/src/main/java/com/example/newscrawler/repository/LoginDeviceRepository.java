package com.example.newscrawler.repository;

import com.example.newscrawler.entity.LoginDevice;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LoginDeviceRepository extends JpaRepository<LoginDevice, Long> {
    Optional<LoginDevice> findByUserIdAndDeviceFingerprint(Long userId, String deviceFingerprint);
    List<LoginDevice> findByUserId(Long userId);
    boolean existsByUserIdAndDeviceFingerprint(Long userId, String deviceFingerprint);

    @org.springframework.data.jpa.repository.Query("SELECT ld.userId, MAX(ld.lastSeenAt) FROM LoginDevice ld GROUP BY ld.userId")
    List<Object[]> aggregateLastSeenByUser();

    long count();

    long countByUserId(Long userId);

    @org.springframework.data.jpa.repository.Query("SELECT MAX(ld.lastSeenAt) FROM LoginDevice ld WHERE ld.userId = :userId")
    java.util.Optional<java.time.Instant> findLastSeenByUserId(@org.springframework.data.repository.query.Param("userId") Long userId);
}