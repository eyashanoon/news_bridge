package com.example.newscrawler.dto;

import java.util.Map;

public class ChannelOnboardingRequest {
    public String adminDescription;
    /** questionId → answer value */
    public Map<String, String> answers;
}
