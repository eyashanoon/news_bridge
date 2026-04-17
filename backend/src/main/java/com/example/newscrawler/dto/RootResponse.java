package com.example.newscrawler.dto;

import java.time.Instant;

public record RootResponse(
        Long id,
        String name,
        String baseUrl,
        String status,
        Boolean active,
        Instant createdAt
) {
}
