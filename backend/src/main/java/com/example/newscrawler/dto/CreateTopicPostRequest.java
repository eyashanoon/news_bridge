package com.example.newscrawler.dto;

import java.util.List;

public class CreateTopicPostRequest {
    public String title;
    public String text;
    public String label;
    public String lang;
    public List<String> tags;
    public String mediaUrl;
    public String mediaType; // "image" or "video"
}