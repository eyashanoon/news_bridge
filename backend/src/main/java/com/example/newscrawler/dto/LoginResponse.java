package com.example.newscrawler.dto;

import java.util.List;

public record LoginResponse(
    String token,
    String email,
    List<String> roles
) {
}
