package com.example.newscrawler.dto;

import java.time.Instant;
import java.util.List;

public class TelegramChannelAdminDto {
    public Long id;
    public String channelUsername;
    public String displayName;
    public String description;
    public String avatarUrl;
    public String status;
    public String language;
    public String region;
    public String purpose;
    public String country;
    public String category;
    public Long subscriberCount;
    public int totalPostsCollected;
    public Instant lastCrawledAt;
    public double crawlScore;
    public int totalCrawls;
    public double postFrequency;
    public double avgViewCount;
    public boolean onboardingCompleted;
    public double crawlPriority;
    public boolean waitlist;
    public double engagementScore;
    public double healthScore;
    public List<TagWeightSummaryDto> mainTags;
    public Instant createdAt;
}
