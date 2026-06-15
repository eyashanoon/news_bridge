package com.example.newscrawler.dto;

import java.util.List;

public class EditorProfileAnalyticsResponse {
    public int periodDays;
    public long totalContent;
    public long livePostCount;
    public long topicPostCount;
    public double approvalRate;
    public long totalEngagement;
    public List<DailyActivityDto> contentOverTime;
    public List<EditorContentItemDto> topPerformingContent;
    public List<TagWeightSummaryDto> categoryDistribution;
}
