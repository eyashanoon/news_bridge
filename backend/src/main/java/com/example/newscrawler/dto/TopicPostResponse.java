package com.example.newscrawler.dto;

import java.time.LocalDateTime;
import java.util.List;

public class TopicPostResponse {
    public Long id;
    public Long topicId;
    public String text;
    public String label;
    public String lang;
    public List<String> tags;
    public int likes;
    public int dislikes;
    public String author;
    public LocalDateTime createdAt;
}