package com.example.newscrawler.dto;

import java.time.Instant;

public record EndpointResponse(
        Long id,
        String url,
        Long rootId,
        String rootName,
        String status,
        Boolean active,
        Instant createdAt,
        Double crawlScore,
        Instant lastCrawledAt,
        Integer totalCrawls,
        String notes,
        Integer pathDepth,
        Long articleCount
) {
    public EndpointResponse(
            Long id,
            String url,
            Long rootId,
            String status,
            Boolean active,
            Instant createdAt,
            Double crawlScore,
            Instant lastCrawledAt,
            Integer totalCrawls
    ) {
        this(id, url, rootId, null, status, active, createdAt, crawlScore, lastCrawledAt, totalCrawls, null, null, null);
    }
}
