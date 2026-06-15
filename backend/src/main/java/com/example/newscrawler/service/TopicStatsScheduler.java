package com.example.newscrawler.service;

import com.example.newscrawler.entity.Topic;
import com.example.newscrawler.repository.TopicRepository;
import com.example.newscrawler.repository.TopicPostRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Scheduled service that recalculates trending statistics for all topics
 * every 60 seconds. The statistics include:
 * - totalLikes / totalDislikes (engagement volume)
 * - totalComments (engagement via reactions)
 * - activityScore (composite score weighing engagement + recency)
 * - lastActivityAt (most recent post timestamp)
 */
@Service
public class TopicStatsScheduler {

    private static final Logger log = LoggerFactory.getLogger(TopicStatsScheduler.class);

    private final TopicRepository topicRepository;
    private final TopicPostRepository topicPostRepository;

    public TopicStatsScheduler(TopicRepository topicRepository,
                               TopicPostRepository topicPostRepository) {
        this.topicRepository = topicRepository;
        this.topicPostRepository = topicPostRepository;
    }

    /**
     * Runs every 60 seconds to recalculate trending statistics for all topics.
     * Uses fixedDelay so the next execution starts only after the current one finishes.
     */
    @Scheduled(fixedDelay = 60_000, initialDelay = 10_000)
    @Transactional
    public void recalculateAllTopicStats() {
        List<Topic> topics = topicRepository.findAll();
        LocalDateTime now = LocalDateTime.now();

        for (Topic topic : topics) {
            recalculateTopicStats(topic, now);
        }

        topicRepository.saveAll(topics);
        log.info("Trending stats recalculated for {} topics at {}", topics.size(), now);
    }

    /**
     * Compute and set trending statistics for a single topic.
     */
    private void recalculateTopicStats(Topic topic, LocalDateTime now) {
        Long topicId = topic.getId();

        // 1. Basic counts
        int postCount = topicPostRepository.countByTopicId(topicId);
        int totalLikes = topicPostRepository.sumLikesByTopicId(topicId);
        int totalDislikes = topicPostRepository.sumDislikesByTopicId(topicId);
        LocalDateTime lastActivityAt = topicPostRepository.findLatestPostCreatedAtByTopicId(topicId);

        topic.setPostCount(postCount);
        topic.setTotalLikes(totalLikes);
        topic.setTotalDislikes(totalDislikes);
        topic.setLastActivityAt(lastActivityAt);

        // 2. Compute composite activity score
        // Factors: post volume, engagement (likes), recency decay
        double activityScore = computeActivityScore(topic, postCount, totalLikes, now);
        topic.setActivityScore(activityScore);

        // 3. Compute growth percentage based on recent activity (last 24h)
        LocalDateTime oneDayAgo = now.minusHours(24);
        int recentPosts = topicPostRepository.countPostsSinceByTopicId(topicId, oneDayAgo);
        int recentLikes = topicPostRepository.sumLikesSinceByTopicId(topicId, oneDayAgo);

        // Growth = weighted combination of recent posts and recent likes, capped at 100
        double rawGrowth = (recentPosts * 10.0) + (recentLikes * 2.0);
        int growth = (int) Math.min(Math.round(rawGrowth), 100);
        topic.setGrowth(growth);

        // 4. Update stats timestamp
        topic.setStatsUpdatedAt(now);
    }

    /**
     * Compute a composite activity score for ranking topics.
     *
     * Formula:
     *   score = (postCount * 1.0) + (totalLikes * 0.5) + recencyBonus
     *
     * recencyBonus decays based on hours since last activity:
     *   - Within 1 hour:   +50
     *   - Within 6 hours:  +30
     *   - Within 24 hours: +15
     *   - Within 72 hours: +5
     *   - Older:           +0
     */
    private double computeActivityScore(Topic topic, int postCount, int totalLikes, LocalDateTime now) {
        double score = 0;

        // Post volume component
        score += postCount * 1.0;

        // Engagement component (likes are weighted more than dislikes)
        score += totalLikes * 0.5;

        // Recency bonus
        LocalDateTime lastActivity = topic.getLastActivityAt();
        if (lastActivity != null) {
            long hoursSince = java.time.Duration.between(lastActivity, now).toHours();
            if (hoursSince <= 1) {
                score += 50;
            } else if (hoursSince <= 6) {
                score += 30;
            } else if (hoursSince <= 24) {
                score += 15;
            } else if (hoursSince <= 72) {
                score += 5;
            }
        }

        return Math.round(score * 100.0) / 100.0; // round to 2 decimal places
    }
}