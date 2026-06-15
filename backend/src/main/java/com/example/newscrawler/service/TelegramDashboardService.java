package com.example.newscrawler.service;

import com.example.newscrawler.dto.TelegramDashboardKpisDto;
import com.example.newscrawler.entity.RecordStatus;
import com.example.newscrawler.entity.TelegramChannel;
import com.example.newscrawler.repository.*;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
public class TelegramDashboardService {

    private final TelegramChannelRepository channelRepo;
    private final TelegramPostRepository postRepo;
    private final UserTelegramContentPreferenceRepository contentPrefRepo;
    private final TelegramEngagementEventRepository engagementRepo;
    private final TelegramScoreService scoreService;

    public TelegramDashboardService(TelegramChannelRepository channelRepo,
                                    TelegramPostRepository postRepo,
                                    UserTelegramContentPreferenceRepository contentPrefRepo,
                                    TelegramEngagementEventRepository engagementRepo,
                                    TelegramScoreService scoreService) {
        this.channelRepo = channelRepo;
        this.postRepo = postRepo;
        this.contentPrefRepo = contentPrefRepo;
        this.engagementRepo = engagementRepo;
        this.scoreService = scoreService;
    }

    public TelegramDashboardKpisDto getKpis() {
        Instant now = Instant.now();
        Instant startOfDay = now.truncatedTo(ChronoUnit.DAYS);
        Instant weekAgo = now.minus(7, ChronoUnit.DAYS);

        TelegramDashboardKpisDto dto = new TelegramDashboardKpisDto();
        dto.totalChannels = channelRepo.count();
        dto.activeChannels = channelRepo.countByStatus(RecordStatus.ACTIVE);
        dto.totalPosts = postRepo.count();
        dto.postsToday = postRepo.countSince(startOfDay);
        dto.postsThisWeek = postRepo.countSince(weekAgo);
        dto.activeTelegramUsers = contentPrefRepo.countActiveSince(weekAgo);

        List<Double> scores = engagementRepo.feedScoresSince(weekAgo);
        if (!scores.isEmpty()) {
            double avg = scores.stream().mapToDouble(Double::doubleValue).average().orElse(0);
            dto.recommendationAccuracyScore = Math.round(avg * 100.0) / 100.0;
        } else {
            dto.recommendationAccuracyScore = 0.0;
        }

        List<TelegramChannel> channels = channelRepo.findAll();
        dto.averageEngagementScore = channels.isEmpty() ? 0.0
                : Math.round(channels.stream().mapToDouble(scoreService::engagementScore).average().orElse(0) * 100.0) / 100.0;
        return dto;
    }
}
