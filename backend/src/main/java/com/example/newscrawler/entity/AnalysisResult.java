package com.example.newscrawler.entity;

public enum AnalysisResult {
    ARTICLE,    // Contains significant content (> 400 chars)
    LISTING,    // Listing page, go deeper
    UNKNOWN,    // Not confidently an article or listing
    VIDEO,      // Contains large video
    ERROR       // Analysis failed
}
