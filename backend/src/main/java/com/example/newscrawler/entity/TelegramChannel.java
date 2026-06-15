package com.example.newscrawler.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "telegram_channels")
@com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class TelegramChannel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String channelUsername;

    @Column
    private String displayName;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(columnDefinition = "TEXT")
    private String avatarUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RecordStatus status = RecordStatus.ACTIVE;

    @Column(nullable = false)
    private int totalPostsCollected = 0;

    @Column
    private Instant lastCrawledAt;

    @Column(name = "crawl_score", nullable = false)
    private double crawlScore = 1.0;

    @Column(name = "total_crawls", nullable = false)
    private int totalCrawls = 0;

    /** Posts per day EMA — used by crawler scheduler */
    @Column(name = "post_frequency", nullable = false)
    private double postFrequency = 0.0;

    @Column(name = "avg_view_count", nullable = false)
    private double avgViewCount = 0.0;

    @Column(name = "onboarding_completed", nullable = false)
    private boolean onboardingCompleted = false;

    @Column(name = "added_by_email")
    private String addedByEmail;

    @Column(name = "subscriber_count")
    private Long subscriberCount;

    @Column(length = 16)
    private String language;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;

    // ---------- getters / setters ----------

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getChannelUsername() { return channelUsername; }
    public void setChannelUsername(String channelUsername) { this.channelUsername = channelUsername; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }

    public RecordStatus getStatus() { return status; }
    public void setStatus(RecordStatus status) { this.status = status; }

    public int getTotalPostsCollected() { return totalPostsCollected; }
    public void setTotalPostsCollected(int totalPostsCollected) { this.totalPostsCollected = totalPostsCollected; }

    public Instant getLastCrawledAt() { return lastCrawledAt; }
    public void setLastCrawledAt(Instant lastCrawledAt) { this.lastCrawledAt = lastCrawledAt; }

    public double getCrawlScore() { return crawlScore; }
    public void setCrawlScore(double crawlScore) { this.crawlScore = crawlScore; }

    public int getTotalCrawls() { return totalCrawls; }
    public void setTotalCrawls(int totalCrawls) { this.totalCrawls = totalCrawls; }

    public double getPostFrequency() { return postFrequency; }
    public void setPostFrequency(double postFrequency) { this.postFrequency = postFrequency; }

    public double getAvgViewCount() { return avgViewCount; }
    public void setAvgViewCount(double avgViewCount) { this.avgViewCount = avgViewCount; }

    public boolean isOnboardingCompleted() { return onboardingCompleted; }
    public void setOnboardingCompleted(boolean onboardingCompleted) { this.onboardingCompleted = onboardingCompleted; }

    public String getAddedByEmail() { return addedByEmail; }
    public void setAddedByEmail(String addedByEmail) { this.addedByEmail = addedByEmail; }

    public Long getSubscriberCount() { return subscriberCount; }
    public void setSubscriberCount(Long subscriberCount) { this.subscriberCount = subscriberCount; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}