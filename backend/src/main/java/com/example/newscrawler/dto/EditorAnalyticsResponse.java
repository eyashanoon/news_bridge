package com.example.newscrawler.dto;

import java.util.List;

public class EditorAnalyticsResponse {
    public int periodDays;
    public long totalEditors;
    public long activeEditors;
    public long suspendedEditors;
    public long pendingEditors;
    public double approvalRate;
    public List<EditorPerformanceDto> topPerformers;
    public List<DailyActivityDto> contributionTrend;
    public List<EditorPerformanceDto> editors;
}
