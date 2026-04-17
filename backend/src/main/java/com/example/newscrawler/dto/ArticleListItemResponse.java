package com.example.newscrawler.dto;

import java.time.Instant;

public record ArticleListItemResponse(
        Long id,
        String title,
        String url,
        Long rootId,
        String rootName,
        Long endpointId,
        String endpointUrl,
        Instant createdAt
) {
}
