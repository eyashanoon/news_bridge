package com.example.newscrawler.dto;

import java.time.LocalDateTime;
import java.util.List;

public class TopicResponse {
    public Long id;
    public String title;
    public String description;
    public String imageUrl;
    public String author;
    public List<String> tags;
    public int growth;
    public int posts;
    public int contributors;
    public String status;
    public String createdByEmail;
    public LocalDateTime createdAt;
    public List<Long> fieldIds;
    public List<String> fieldNames;
}