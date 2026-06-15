package com.example.newscrawler.dto;

import java.util.List;

public class UserSummaryAnalyticsResponse {
    public long totalRegisteredUsers;
    public long totalEditors;
    public long activeUsers;
    public long suspendedUsers;
    public long pendingUsers;
    public long inactiveUsers;
    public double averageActivityScore;
    public List<RoleDistributionDto> roleDistribution;
    public List<RoleDistributionDto> statusDistribution;
}
