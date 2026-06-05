package com.example.newscrawler.controller;

import com.example.newscrawler.security.JwtTokenProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/primitive-users")
public class PrimitiveUserController {

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    // Shared counter for synthetic IDs (same approach as AuthController)
    private static long primitiveUserIdCounter = System.currentTimeMillis();

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> createPrimitiveUser() {
        // Use a synthetic ID that does NOT create a database record
        long syntheticId = ++primitiveUserIdCounter;
        String jwtToken = jwtTokenProvider.generateTokenForPrimitiveUser(syntheticId);
        return Map.of("token", jwtToken);
    }
}