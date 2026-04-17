package com.example.newscrawler.dto;

public class CreateNewsEventRequest {
    public String title;
    public String description;
    public Long fieldId;
    public String status; // DRAFT, EDITOR_VISIBLE, PUBLIC
}
