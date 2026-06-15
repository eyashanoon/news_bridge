package com.example.newscrawler.dto;

import java.time.Instant;
import java.util.List;

public class TelegramPostDetailDto {
    public Long id;
    public Long channelId;
    public String channelUsername;
    public String channelDisplayName;
    public String content;
    public String mediaUrl;
    public String mediaType;
    public Instant messageDate;
    public int viewCount;
    public boolean edited;
    public List<String> tags;
    public RecommendationImpactDto recommendationImpact;
}
