package com.example.newscrawler.dto;

import org.hibernate.validator.constraints.URL;

import jakarta.validation.constraints.NotBlank;

public record CreateRootRequest(
        @NotBlank String name,
        @NotBlank @URL String baseUrl
) {
}
