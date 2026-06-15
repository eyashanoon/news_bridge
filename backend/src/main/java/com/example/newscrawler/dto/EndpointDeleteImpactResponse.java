package com.example.newscrawler.dto;

public record EndpointDeleteImpactResponse(
        Long endpointId,
        String url,
        long articleCount,
        long cacheEndpointCount,
        int totalCrawls,
        boolean hasHistoricalCrawlData
) {
}
