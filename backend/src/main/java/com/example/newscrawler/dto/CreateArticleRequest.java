package com.example.newscrawler.dto;

import org.hibernate.validator.constraints.URL;

import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateArticleRequest(
        @NotBlank @URL String url,
        @NotBlank String title,
        String text,
        @NotNull Long endpointId,
        @NotNull Long cacheEndpointId,
        List<CreateArticleBlockRequest> blocks
) {
}
