package com.example.newscrawler.dto;

import org.hibernate.validator.constraints.URL;

import jakarta.validation.constraints.NotBlank;

public record UpdateEndpointRequest(
        @NotBlank @URL String url,
        Long rootId,
        Double crawlScore,
        String notes
) {
}
