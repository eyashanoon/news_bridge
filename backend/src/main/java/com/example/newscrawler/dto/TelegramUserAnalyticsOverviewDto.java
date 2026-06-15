package com.example.newscrawler.dto;

import java.time.Instant;
import java.util.List;

public class TelegramUserAnalyticsOverviewDto {
    public long usersWithPreferences;
    public long activeUsersLast30Days;
    public long totalEngagementEvents;
    public long viewsLast30Days;
    public long readTimeEventsLast30Days;
    public Instant generatedAt;

    public List<LabelCountDto> topCategories;
    public List<LabelCountDto> topRegions;
    public List<LabelCountDto> topTopics;
    public List<LabelCountDto> topTags;
    public List<LabelCountDto> fastestGrowingInterests;
    public List<LabelCountDto> decliningInterests;
    public List<LabelCountDto> topContentTypes;
}
