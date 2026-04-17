package com.example.newscrawler.dto;

import java.time.Instant;

public record EndpointResponse(
        Long id,
        String url,
        Long rootId,
        String status,
        Boolean active,
        Instant createdAt
) {
}
