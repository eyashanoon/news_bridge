package com.example.newscrawler.dto;

import org.hibernate.validator.constraints.URL;

import jakarta.validation.constraints.NotBlank;

public record CreateEndpointRequest(
        @NotBlank @URL String url,
        Long rootId
) {
}
