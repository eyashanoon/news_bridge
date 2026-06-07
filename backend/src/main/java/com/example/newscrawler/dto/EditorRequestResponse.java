package com.example.newscrawler.dto;

import java.time.LocalDateTime;
import java.util.List;

public class EditorRequestResponse {
    public Long id;
    public Long userId;
    public String userEmail;
    public List<CategoryFieldDto> fields;
    public String experience;
    public String phone;
    public String profilePicture;
    public String status;
    public String references;
    public List<String> attachments;
    public LocalDateTime createdAt;
    public LocalDateTime updatedAt;
}
