package com.example.newscrawler.dto;

import java.time.LocalDateTime;

public class TopicAssignmentResponse {
    public Long id;
    public Long topicId;
    public String topicTitle;
    public Long editorId;
    public String editorEmail;
    public String editorName;
    public String status; // REQUESTED, APPROVED, REJECTED, ASSIGNED
    public String assignedBy;
    public LocalDateTime createdAt;
}