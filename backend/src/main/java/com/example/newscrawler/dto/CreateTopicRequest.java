package com.example.newscrawler.dto;

import java.util.List;

public class CreateTopicRequest {
    public String title;
    public String description;
    public String imageUrl;
    public String author;
    public List<String> tags;
    public List<Long> fieldIds;
    public String status; // DRAFT, ACTIVE, INACTIVE
}