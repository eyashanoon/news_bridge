package com.example.newscrawler.service;

import com.example.newscrawler.dto.UserActivityMetricsDto;
import com.example.newscrawler.entity.ReactionType;
import com.example.newscrawler.repository.LoginDeviceRepository;
import com.example.newscrawler.repository.PostInteractionRepository;
import com.example.newscrawler.repository.PostReactionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class UserActivityMetricsService {

    @Autowired
    private PostInteractionRepository interactionRepository;

    @Autowired
    private LoginDeviceRepository loginDeviceRepository;

    @Autowired
    private PostReactionRepository reactionRepository;

    private volatile Map<Long, UserActivityMetricsDto> cache;
    private volatile long cacheLoadedAt;

    public UserActivityMetricsDto getMetrics(Long userId) {
        return loadCache().getOrDefault(userId, emptyMetrics());
    }

    public Map<Long, UserActivityMetricsDto> getAllMetrics() {
        return loadCache();
    }

    public void invalidateCache() {
        cacheLoadedAt = 0;
    }

    private Map<Long, UserActivityMetricsDto> loadCache() {
        long now = System.currentTimeMillis();
        if (cache != null && now - cacheLoadedAt < 60_000) {
            return cache;
        }
        synchronized (this) {
            if (cache != null && now - cacheLoadedAt < 60_000) {
                return cache;
            }
            cache = buildCache();
            cacheLoadedAt = System.currentTimeMillis();
            return cache;
        }
    }

    private Map<Long, UserActivityMetricsDto> buildCache() {
        Map<Long, UserActivityMetricsDto> map = new HashMap<>();

        for (Object[] row : interactionRepository.aggregateEngagementByUser()) {
            Long userId = (Long) row[0];
            long views = ((Number) row[1]).longValue();
            long clicks = ((Number) row[2]).longValue();
            double timeSpent = ((Number) row[3]).doubleValue();
            UserActivityMetricsDto dto = map.computeIfAbsent(userId, id -> emptyMetrics());
            dto.activityScore += views + clicks * 3.0 + timeSpent * 0.1;
        }

        for (Object[] row : interactionRepository.aggregateLastViewedByUser()) {
            Long userId = (Long) row[0];
            LocalDateTime lastViewed = (LocalDateTime) row[1];
            if (lastViewed == null) continue;
            UserActivityMetricsDto dto = map.computeIfAbsent(userId, id -> emptyMetrics());
            Instant viewedAt = lastViewed.atZone(ZoneOffset.UTC).toInstant();
            if (dto.lastActivityAt == null || viewedAt.isAfter(dto.lastActivityAt)) {
                dto.lastActivityAt = viewedAt;
            }
        }

        for (Object[] row : loginDeviceRepository.aggregateLastSeenByUser()) {
            Long userId = (Long) row[0];
            Instant lastSeen = (Instant) row[1];
            if (lastSeen == null) continue;
            UserActivityMetricsDto dto = map.computeIfAbsent(userId, id -> emptyMetrics());
            if (dto.lastActivityAt == null || lastSeen.isAfter(dto.lastActivityAt)) {
                dto.lastActivityAt = lastSeen;
            }
        }

        for (Object[] row : reactionRepository.aggregateByUserAndType()) {
            Long userId = (Long) row[0];
            ReactionType type = (ReactionType) row[1];
            long count = ((Number) row[2]).longValue();
            UserActivityMetricsDto dto = map.computeIfAbsent(userId, id -> emptyMetrics());
            if (type == ReactionType.LIKE) {
                dto.activityScore += count * 2.0;
            } else if (type == ReactionType.DISLIKE) {
                dto.activityScore += count * 0.5;
            }
        }

        for (UserActivityMetricsDto dto : map.values()) {
            dto.activityLevel = resolveLevel(dto.activityScore, dto.lastActivityAt);
        }
        return map;
    }

    public static String resolveLevel(double score, Instant lastActivityAt) {
        if (lastActivityAt != null) {
            long daysSince = (Instant.now().getEpochSecond() - lastActivityAt.getEpochSecond()) / 86400;
            if (daysSince > 30) {
                return "INACTIVE";
            }
        } else if (score <= 0) {
            return "INACTIVE";
        }
        if (score >= 50) return "HIGH";
        if (score >= 20) return "MEDIUM";
        if (score >= 5) return "LOW";
        return "INACTIVE";
    }

    private UserActivityMetricsDto emptyMetrics() {
        UserActivityMetricsDto dto = new UserActivityMetricsDto();
        dto.activityScore = 0;
        dto.activityLevel = "INACTIVE";
        return dto;
    }
}
