package com.example.newscrawler.dto;

import java.util.Set;

public class RegisteredUserResponse {
    public Long id;
    public String username;
    public String email;
    public String type;
    public String status;
    public Boolean active;
    public Set<String> roles;
}
