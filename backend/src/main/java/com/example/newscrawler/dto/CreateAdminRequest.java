package com.example.newscrawler.dto;

import jakarta.validation.constraints.NotBlank;
import java.util.List;

public class CreateAdminRequest {
    @NotBlank
    public String email;
    @NotBlank
    public String password;

    public List<String> roles;
    public String profilePicture;
}
