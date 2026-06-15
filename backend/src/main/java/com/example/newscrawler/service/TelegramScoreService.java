package com.example.newscrawler.service;

import com.example.newscrawler.entity.ChannelPreferenceProfile;
import com.example.newscrawler.entity.TelegramChannel;
import com.example.newscrawler.repository.TelegramEngagementEventRepository;
import com.example.newscrawler.repository.TelegramPostRepository;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;

@Service
public class TelegramScoreService {

    private final ChannelScoringService scoringService;
    private final TelegramEngagementEventRepository engagementRepo;
    private final TelegramPostRepository postRepo;

    public TelegramScoreService(ChannelScoringService scoringService,
                                TelegramEngagementEventRepository engagementRepo,
                                TelegramPostRepository postRepo) {
        this.scoringService = scoringService;
        this.engagementRepo = engagementRepo;
        this.postRepo = postRepo;
    }

    public double engagementScore(TelegramChannel ch) {
        long views = engagementRepo.countByChannelId(ch.getId());
        double viewNorm = Math.min(1.0, views / 100.0);
        double freqNorm = Math.min(1.0, ch.getPostFrequency() / 10.0);
        double viewsNorm = Math.min(1.0, Math.log1p(ch.getAvgViewCount()) / 10.0);
        return round(0.4 * viewsNorm + 0.3 * freqNorm + 0.3 * viewNorm);
    }

    public double healthScore(TelegramChannel ch, ChannelPreferenceProfile profile) {
        double onboarding = ch.isOnboardingCompleted() ? 1.0 : 0.0;
        double crawlRecency = 0.0;
        if (ch.getLastCrawledAt() != null) {
            long hours = Duration.between(ch.getLastCrawledAt(), Instant.now()).toHours();
            if (hours <= 24) crawlRecency = 1.0;
            else if (hours <= 72) crawlRecency = 0.7;
            else if (hours <= 168) crawlRecency = 0.4;
            else crawlRecency = 0.1;
        }
        long totalPosts = postRepo.countByChannel_Id(ch.getId());
        long untagged = postRepo.countByChannel_IdAndTagsExtractedFalse(ch.getId());
        double taggingCoverage = totalPosts == 0 ? 0.0 : Math.min(1.0, 1.0 - ((double) untagged / totalPosts));
        double profileComplete = profile != null && profile.isOnboardingCompleted() ? 1.0 : 0.0;
        return round(0.25 * onboarding + 0.25 * profileComplete + 0.25 * crawlRecency + 0.25 * taggingCoverage);
    }

    public double crawlPriority(TelegramChannel ch) {
        return scoringService.computeCrawlPriority(ch);
    }

    public boolean waitlist(TelegramChannel ch) {
        return scoringService.isWaitlist(ch);
    }

    private static double round(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
