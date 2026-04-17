package com.example.newscrawler.dto;

import java.time.Instant;
import java.util.List;

public class CreateTelegramPostRequest {
    public Long channelId;
    public Long telegramMessageId;
    public String content;
    public String mediaUrl;
    public String mediaType;
    public Instant messageDate;
    public int viewCount;
    public boolean edited;
}
