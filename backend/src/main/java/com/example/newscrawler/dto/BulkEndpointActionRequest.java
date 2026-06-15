package com.example.newscrawler.dto;

import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

public record BulkEndpointActionRequest(
        @NotEmpty List<Long> endpointIds,
        @NotBlank String action,
        Double crawlPriority,
        Long rootId,
        Boolean hardDelete
) {
}
