package com.example.newscrawler.dto;

import java.time.Instant;

public class TelegramChannelResponse {
    public Long id;
    public String channelUsername;
    public String displayName;
    public String description;
    public String avatarUrl;
    public String status;
    public int totalPostsCollected;
    public Instant lastCrawledAt;
    public double crawlScore;
    public int totalCrawls;
    public double postFrequency;
    public double avgViewCount;
    public boolean onboardingCompleted;
    public double crawlPriority;
    public boolean waitlist;
    public String addedByEmail;
    public Instant createdAt;
    public Instant updatedAt;
}
