package com.example.newscrawler.dto;

import java.util.List;
import java.time.Instant;

public record ArticleResponse(
        Long id,
        String url,
        String title,
        String text,
        Long endpointId,
        Long cacheEndpointId,
        List<ArticleBlockResponse> blocks,
        Instant createdAt
) {
}
