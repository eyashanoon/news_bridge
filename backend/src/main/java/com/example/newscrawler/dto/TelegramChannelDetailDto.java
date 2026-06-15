package com.example.newscrawler.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public class TelegramChannelDetailDto {
    public TelegramChannelAdminDto channel;
    public String adminDescription;
    public String categoryTreePath;
    public Map<String, String> onboardingAnswers;
    public List<TagWeightSummaryDto> tags;
    public ProfileQualityDto profileQuality;
    public Instant profileUpdatedAt;
}
