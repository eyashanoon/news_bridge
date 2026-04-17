package com.example.newscrawler.dto;

import java.time.Instant;

public class NewsEventResponse {
    public Long id;
    public String title;
    public String description;
    public CategoryFieldDto field;
    public String status;
    public String createdByEmail;
    public Instant createdAt;
    public Instant updatedAt;
}
