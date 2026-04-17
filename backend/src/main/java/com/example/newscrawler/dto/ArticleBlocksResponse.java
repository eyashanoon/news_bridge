package com.example.newscrawler.dto;

import java.util.List;

public record ArticleBlocksResponse(
        Long articleId,
        String articleUrl,
        String rootName,
        Long endpointId,
        String endpointUrl,
        String title,
        List<ArticleBlockResponse> blocks
) {
}
