package com.example.newscrawler.dto;
import java.time.Instant;
import java.util.Set;
public class AdminResponse {
    public Long id;
    public String email;
    public String profilePicture;
    public String status;
    public Boolean active;
    public Set<String> roles;
    public Set<String> permissionGroups;
    public String activityLevel;
    public Instant createdAt;
    public Instant lastActivityAt;
}
