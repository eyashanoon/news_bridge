package com.example.newscrawler.dto;

import java.time.Instant;

public class FrontendUserResponse {
    public Long id;
    public String username;
    public String fullName;
    public String email;
    public String type;
    public String status;
    public Instant createdAt;
    public Instant lastActivityAt;
    public Double activityScore;
    public String activityLevel;
}
