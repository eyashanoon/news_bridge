package com.example.newscrawler.dto;

import com.example.newscrawler.entity.AnalysisResult;
import java.time.LocalDateTime;

public record CacheEndpointResponse(
    Long id,
    String url,
    AnalysisResult result,
    String extractedText,
    String extractedTitle,
    String extractedContentJson,
    String domPattern,
    Long sourceEndpointId,
    LocalDateTime analyzedAt,
    LocalDateTime createdAt
) {
}
