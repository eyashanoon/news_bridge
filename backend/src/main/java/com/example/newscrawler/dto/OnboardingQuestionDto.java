package com.example.newscrawler.dto;

import java.util.List;
import java.util.Map;

public class OnboardingQuestionDto {
    public String id;
    public String text;
    public String type; // "choice" | "text" | "location"
    public List<OnboardingOptionDto> options;
    public boolean required = true;
}
