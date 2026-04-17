package com.example.newscrawler.dto;

import java.time.Instant;

public class TelegramPostResponse {
    public Long id;
    public Long channelId;
    public String channelUsername;
    public String channelDisplayName;
    public Long telegramMessageId;
    public String content;
    public String mediaUrl;
    public String mediaType;
    public Instant messageDate;
    public int viewCount;
    public boolean edited;
    public Instant collectedAt;
}
