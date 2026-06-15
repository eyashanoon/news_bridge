package com.example.newscrawler.dto;

import jakarta.validation.constraints.NotBlank;

public record AssessEndpointRequest(
        @NotBlank String url
) {}
