package com.example.newscrawler.dto;

import java.util.List;

public record BulkEndpointActionResponse(
        String action,
        int affected,
        List<Long> endpointIds,
        List<String> errors
) {
}
