package com.example.newscrawler.dto;

import java.time.Instant;
import java.util.List;

public class TelegramFeedPostDto {
    public Long id;
    public Long channelId;
    public String channelUsername;
    public String channelDisplayName;
    public String content;
    public String mediaUrl;
    public String mediaType;
    public Instant messageDate;
    public Long viewCount;
    public boolean edited;
    public Double score;
    /** Admin channel description shown in discover results (not article categories). */
    public String channelDescription;
    /** Tags extracted from post content via tag service. */
    public List<String> tags;
}
