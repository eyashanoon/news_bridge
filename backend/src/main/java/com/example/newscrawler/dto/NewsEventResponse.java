package com.example.newscrawler.dto;

import java.time.Instant;
import java.util.List;

public class NewsEventResponse {
    public Long id;
    public String title;
    public String description;
    public CategoryFieldDto field;
    public List<Long> fieldIds;
    public String status;
    public String createdByEmail;
    public Instant createdAt;
    public Instant updatedAt;
    /**
     * ID of the trending-topics entry that was auto-created from this event
     * (so the admin UI / API can correlate the two and so deletion is reliable).
     */
    public Long topicId;
}
