package com.example.newscrawler.dto;

import java.util.List;

public class UserGrowthAnalyticsResponse {
    public int periodDays;
    public long totalNewUsers;
    public long totalUsers;
    public List<DailyActivityDto> registrationsPerDay;
    public List<DailyActivityDto> cumulativeGrowth;
}
