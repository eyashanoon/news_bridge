package com.example.newscrawler.dto;

import java.time.Instant;

public record RootEndpointAnalyticsDto(
        Long rootId,
        String rootName,
        long totalEndpoints,
        long activeEndpoints,
        long disabledEndpoints,
        double averageDiscoveryDepth,
        Instant lastEndpointAddedAt,
        double crawlSuccessRate,
        double crawlFailureRate
) {
}
