package com.example.newscrawler.dto;

import java.util.List;

public class UserPreferencesAnalyticsResponse {
    public long totalFrontendUsers;
    public long registeredUserCount;
    public long editorUserCount;
    public long usersWithPreferences;
    public long usersWithChannelPreferences;
    public List<TagWeightSummaryDto> topTags;
    public List<ChannelAffinitySummaryDto> topChannels;
    public List<PreferenceClusterDto> preferenceClusters;
    public List<TagWeightSummaryDto> topCategories;
}
