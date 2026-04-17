package com.example.newscrawler.dto;

import java.util.Set;
import java.util.List;

public class EditorUserResponse {
    public Long id;
    public String username;
    public String email;
    public String type;
    public String status;
    public Boolean active;
    public Set<String> roles;
    public String fieldName;
    public String phone;
    public String profilePicture;
    public String experience;
    public String references;
    public List<String> attachments;
}
