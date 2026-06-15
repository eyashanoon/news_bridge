package com.example.newscrawler.dto;

public record VerificationSourceDto(
        String name,
        boolean matched,
        String summary
) {}
