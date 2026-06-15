package com.example.newscrawler.service;

import com.example.newscrawler.entity.TelegramChannel;
import com.example.newscrawler.repository.ChannelPreferenceProfileRepository;
import com.example.newscrawler.util.TagVectorUtils;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;

/**
 * Computes crawl priority scores for Telegram channels.
 * Used by the Python crawler scheduler via API responses.
 */
@Service
public class ChannelScoringService {

    private static final double WAITLIST_THRESHOLD = 2.0;

    private final ChannelPreferenceProfileRepository profileRepo;

    public ChannelScoringService(ChannelPreferenceProfileRepository profileRepo) {
        this.profileRepo = profileRepo;
    }

    public double computeCrawlPriority(TelegramChannel ch) {
        double score = ch.getCrawlScore();

        // Posting frequency boost (0–5)
        score += Math.min(5.0, ch.getPostFrequency() * 2.0);

        // Engagement boost (0–3)
        score += Math.min(3.0, Math.log1p(ch.getAvgViewCount()) / 5.0);

        // Recency staleness bonus
        if (ch.getLastCrawledAt() != null) {
            double hours = Duration.between(ch.getLastCrawledAt(), Instant.now()).toHours();
            score += Math.sqrt(Math.max(0, hours)) * 0.5;
        } else {
            score += 50.0; // never crawled — high urgency
        }

        // Onboarding intent completeness
        if (ch.isOnboardingCompleted()) {
            score += 2.0;
        }

        return score;
    }

    public boolean isWaitlist(TelegramChannel ch) {
        return computeCrawlPriority(ch) < WAITLIST_THRESHOLD && ch.getTotalCrawls() > 3;
    }

    /** Semantic similarity between channel profile and user preference tags. */
    public double userChannelAffinity(TelegramChannel ch, Map<String, Double> userPrefs) {
        return profileRepo.findByChannel_Id(ch.getId())
                .map(p -> TagVectorUtils.similarity(
                        TagVectorUtils.parseVector(p.getFinalTagVector()),
                        userPrefs))
                .orElse(0.0);
    }

    public double tagRelevanceScore(TelegramChannel ch, Map<String, Double> userPrefs) {
        return userChannelAffinity(ch, userPrefs);
    }
}
