package com.example.newscrawler.dto;

import java.time.Instant;
import java.util.Set;
import java.util.List;

public class EditorUserResponse {
    public Long id;
    public String username;
    public String fullName;
    public String email;
    public String type;
    public String status;
    public Boolean active;
    public Set<String> roles;
    public String fieldName;
    public String phone;
    public String profilePicture;
    public String experience;
    public String references;
    public List<String> attachments;
    public Instant createdAt;
    public Instant lastActivityAt;
    public Double activityScore;
    public String activityLevel;
    public Long contributionCount;
    public Instant lastContributionAt;
    public String approvalStatus;
    public Long editorRequestId;
    public String roleLevel;
    public List<Long> assignedCategoryIds;
    public Long livePostCount;
    public Long topicPostCount;
}