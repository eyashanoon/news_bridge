package com.example.newscrawler.dto;

import java.util.List;

public class UserInteractionsAnalyticsResponse {
    public int periodDays;
    public long totalFrontendUsers;
    public long activeUsersInPeriod;
    public long totalViews;
    public long totalClicks;
    public double totalTimeSpent;
    public long totalLikes;
    public long totalDislikes;
    public List<DailyActivityDto> interactionsPerDay;
    public List<UserEngagementSummaryDto> topEngagedUsers;
}
