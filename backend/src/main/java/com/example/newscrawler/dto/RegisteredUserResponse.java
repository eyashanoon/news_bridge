package com.example.newscrawler.dto;

import java.time.Instant;
import java.util.Set;

public class RegisteredUserResponse {
    public Long id;
    public String username;
    public String fullName;
    public String email;
    public String type;
    public String status;
    public Boolean active;
    public Set<String> roles;
    public Instant createdAt;
    public Instant lastActivityAt;
    public Double activityScore;
    public String activityLevel;
    public String roleType;
}