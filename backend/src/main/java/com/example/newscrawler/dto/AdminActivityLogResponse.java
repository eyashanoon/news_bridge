package com.example.newscrawler.dto;

import java.time.Instant;

public class AdminActivityLogResponse {
    public Long id;
    public Long adminId;
    public String adminEmail;
    public String action;
    public Instant timestamp;
    public String status;
    public String targetResource;
    public String result;
}
