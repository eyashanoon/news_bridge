package com.example.newscrawler.dto;

import java.util.List;

public class CreateNewsEventRequest {
    public String title;
    public String description;
    public Long fieldId;
    public List<Long> fieldIds;
    public String status; // DRAFT, EDITOR_VISIBLE, PUBLIC
}