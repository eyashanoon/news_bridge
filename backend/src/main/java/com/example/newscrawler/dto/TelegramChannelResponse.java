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
    public String addedByEmail;
    public Instant createdAt;
    public Instant updatedAt;
}
