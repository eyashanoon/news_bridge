package com.example.newscrawler.dto;

import java.util.List;

public class UserActivityAnalyticsResponse {
    public int periodDays;
    public long activeUsers;
    public long inactiveUsers;
    public long totalSessions;
    public List<DailyActivityDto> interactionsPerDay;
    public List<DailyActivityDto> activeUsersPerDay;
    public List<DailyActivityDto> activityHeatmap;
}
