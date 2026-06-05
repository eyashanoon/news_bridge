package com.example.newscrawler.dto;

import java.util.List;

public class CreateTopicPostRequest {
    public String text;
    public String label;
    public String lang;
    public List<String> tags;
}