package com.example.newscrawler.dto;

import java.util.List;

public record ArticleContentResponse(List<ArticleContentItemResponse> content) {
}
