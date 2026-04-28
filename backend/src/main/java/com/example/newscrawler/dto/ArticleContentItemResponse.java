package com.example.newscrawler.dto;

public record ArticleContentItemResponse(
        String type,
        String text,
        String url,
        String mediaType,
        Integer sortOrder
) {
}
