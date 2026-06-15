package com.example.newscrawler.dto;

import java.time.Instant;
import java.util.List;

public class TelegramPostAdminDto {
    public Long id;
    public Long channelId;
    public String channelUsername;
    public String channelDisplayName;
    public String contentPreview;
    public String mediaUrl;
    public String mediaType;
    public Instant messageDate;
    public int viewCount;
    public boolean edited;
    public boolean tagsExtracted;
    public List<String> tags;
    public double engagementScore;
    public Instant collectedAt;
}
