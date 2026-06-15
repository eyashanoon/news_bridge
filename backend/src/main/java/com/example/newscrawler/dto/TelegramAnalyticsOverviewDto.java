package com.example.newscrawler.dto;

import java.util.List;

public class TelegramAnalyticsOverviewDto {
    public List<DailyActivityDto> channelGrowth;
    public List<DailyActivityDto> postsPerDay;
    public List<LabelCountDto> mostActiveChannels;
    public List<LabelCountDto> mostViewedChannels;
    public List<LabelCountDto> highestEngagementChannels;
    public List<LabelCountDto> regionalDistribution;
    public List<LabelCountDto> categoryDistribution;
}
