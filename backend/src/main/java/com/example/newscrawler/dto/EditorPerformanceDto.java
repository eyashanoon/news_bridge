package com.example.newscrawler.dto;

import java.time.Instant;

public class EditorPerformanceDto {
    public Long editorId;
    public String email;
    public String username;
    public String status;
    public long contributionCount;
    public Instant lastActivityAt;
    public Instant lastContributionAt;
    public double activityScore;
    public String approvalStatus;
}
