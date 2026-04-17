package com.example.newscrawler.dto;

import com.example.newscrawler.entity.AnalysisResult;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;


public record CreateCacheEndpointRequest(
    @NotBlank(message = "URL is required")
    
    String url,
    
    @NotNull(message = "Analysis result is required")
    AnalysisResult result,
    
    String extractedText,

    String extractedTitle,

    String extractedContentJson,
    
    String domPattern,
    
    @NotNull(message = "Source endpoint ID is required")
    Long sourceEndpointId
) {
}
