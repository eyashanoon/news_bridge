package com.example.newscrawler.dto;

import java.util.List;
import java.util.Map;

public class TelegramCrawlerDashboardDto {
    public Map<String, Object> crawlerStatus;
    public long taggedPosts;
    public long pendingPosts;
    public double taggingSuccessRate;
    public Double averageCrawlTimeMs;
    public Double averagePostsRetrieved;
    public double crawlSuccessRate;
    public List<LabelCountDto> crawlStatusBreakdown;
}
