package com.example.newscrawler.dto;

import com.example.newscrawler.entity.ArticleBlockType;

import jakarta.validation.constraints.NotNull;

public record CreateArticleBlockRequest(
        @NotNull Integer sortOrder,
        @NotNull ArticleBlockType blockType,
        String textContent,
        String mediaUrl,
        String altText,
        Double score
) {
}
