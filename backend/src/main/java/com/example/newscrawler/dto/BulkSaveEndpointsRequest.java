package com.example.newscrawler.dto;

import java.util.List;
import jakarta.validation.constraints.NotNull;

public record BulkSaveEndpointsRequest(
        @NotNull List<String> urls
) {}
