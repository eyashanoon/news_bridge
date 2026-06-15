package com.example.newscrawler.dto;

import java.time.Instant;
import java.util.Set;

public class FrontendUserListResponse {
    public Long id;
    public String username;
    public String fullName;
    public String email;
    public String type;
    public String status;
    public Boolean active;
    public Set<String> roles;
    public String roleType;
    public String roleLevel;
    public String fieldName;
    public Instant createdAt;
    public Instant lastActivityAt;
    public Double activityScore;
    public String activityLevel;
    public Long contributionCount;
}
