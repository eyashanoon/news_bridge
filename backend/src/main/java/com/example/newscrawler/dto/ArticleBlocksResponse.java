package com.example.newscrawler.dto;

import java.util.List;
import java.time.Instant;

public record ArticleBlocksResponse(
        Long articleId,
        String articleUrl,
        String rootName,
        Long endpointId,
        String endpointUrl,
        String title,
        Instant createdAt,
        List<ArticleBlockResponse> blocks
) {
}
