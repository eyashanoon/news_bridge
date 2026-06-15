package com.example.newscrawler.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public class UserBehaviorProfileResponse {
    public Long userId;
    public String email;
    public String username;
    public String fullName;
    public String userType;
    public String status;
    public Instant registeredAt;
    public Instant lastActivityAt;
    public Instant lastLoginAt;
    public double overallEngagementScore;
    public String activityLevel;
    public int periodDays;
    public long periodViews;
    public long periodClicks;
    public double periodTimeSpent;
    public long periodInteractions;
    public long lifetimeViews;
    public long lifetimeClicks;
    public double lifetimeTimeSpent;
    public long lifetimeLikes;
    public long lifetimeDislikes;
    public long preferenceTagCount;
    public long channelAffinityCount;
    public long loginDeviceCount;
    public List<DailyActivityDto> activityPerDay;
    public List<TagWeightSummaryDto> interestScores;
    public List<ChannelAffinitySummaryDto> channelAffinities;
    public Map<String, Double> contentTypePreference;
}
