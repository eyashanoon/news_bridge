package com.example.newscrawler.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;

public class LoginRequest {
    @NotBlank(message = "Username or email is required")
    @JsonProperty("username")
    @JsonAlias("email")
    private String username;

    @NotBlank(message = "Password is required")
    private String password;

    // No-arg constructor needed for Jackson
    public LoginRequest() {}

    public LoginRequest(String username, String password) {
        this.username = username;
        this.password = password;
    }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public boolean isEmail() {
        return username != null && username.contains("@");
    }

    public String email() {
        return isEmail() ? username : null;
    }
}