package com.example.newscrawler.dto;

import java.time.Instant;

public class LiveNewsPostResponse {
    public Long id;
    public Long eventId;
    public String eventTitle;
    public Long authorId;
    public String authorEmail;
    public String authorName;
    public String authorAvatar;
    public String headline;
    public String content;
    public Instant publishedAt;
    public Instant updatedAt;
}
