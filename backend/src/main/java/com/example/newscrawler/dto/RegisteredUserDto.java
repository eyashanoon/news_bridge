package com.example.newscrawler.dto;

import com.example.newscrawler.entity.UserStatus;

public class RegisteredUserDto {
    public Long id;
    public String username;
    public String email;
    public String fullName;
    public String bio;
    public String profilePicture;
    public UserStatus status;
}