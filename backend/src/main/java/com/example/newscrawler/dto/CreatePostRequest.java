package com.example.newscrawler.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreatePostRequest(
    @NotBlank String text,
    String label,
    String lang,
    String title,
    int numImages,
    @NotNull Long articleId
) {}
