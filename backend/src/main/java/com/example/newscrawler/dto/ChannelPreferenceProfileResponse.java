package com.example.newscrawler.dto;

import java.time.Instant;

public class ChannelPreferenceProfileResponse {
    public Long channelId;
    public String adminDescription;
    public String categoryTreePath;
    public String finalTagVector;
    public boolean onboardingCompleted;
    public Instant updatedAt;
}
