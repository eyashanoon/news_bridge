package com.example.newscrawler.dto;

import java.util.List;
import java.util.Map;

public class AdminAnalyticsResponse {
    public List<AdminActivityCountDto> mostActiveAdmins;
    public List<DailyActivityDto> actionsPerDay;
    public List<ActionTypeCountDto> actionsByType;
    public List<RoleDistributionDto> roleDistribution;
    public List<StatusCountDto> actionsByStatus;
    public long totalActions;
    public long periodDays;
    public long activeAdmins;
    public long successCount;
    public long failureCount;
    public double avgActionsPerDay;
    public double successRate;
}
