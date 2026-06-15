package com.example.newscrawler.dto;

import java.util.List;

public class TelegramRecommendationInsightsDto {
    public List<LabelCountDto> topRecommendedChannels;
    public List<LabelCountDto> topRecommendedTags;
    public List<LabelCountDto> topRecommendedTopics;
    public TelegramSimilarityGraphDto similarityGraph;
}
