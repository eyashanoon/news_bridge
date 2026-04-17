package com.example.newscrawler.dto;

import java.time.Instant;

import com.example.newscrawler.entity.ArticleBlockType;

public record ArticleBlockResponse(
        Long id,
        Integer sortOrder,
        ArticleBlockType blockType,
        String textContent,
        String mediaUrl,
        String altText,
        Double score,
        Instant createdAt
) {
}
