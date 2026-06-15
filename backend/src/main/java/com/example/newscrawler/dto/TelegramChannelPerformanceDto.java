package com.example.newscrawler.dto;

public class TelegramChannelPerformanceDto {
    public double crawlFrequencyPerDay;
    public double crawlSuccessRate;
    public long failedCrawlCount;
    public long successfulCrawlCount;
    public Double averageCrawlDurationMs;
    public Double averagePostsRetrieved;
}
