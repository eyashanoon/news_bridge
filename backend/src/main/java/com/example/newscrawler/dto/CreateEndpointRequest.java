package com.example.newscrawler.dto;

import org.hibernate.validator.constraints.URL;

import jakarta.validation.constraints.NotBlank;

public record CreateEndpointRequest(
        @NotBlank @URL String url,
        Long rootId,
        Double crawlScore,
        String notes
) {
    public CreateEndpointRequest(String url, Long rootId) {
        this(url, rootId, null, null);
    }
}
