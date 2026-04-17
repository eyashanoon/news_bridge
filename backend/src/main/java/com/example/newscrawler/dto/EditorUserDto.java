package com.example.newscrawler.dto;

import com.example.newscrawler.entity.UserStatus;
import java.util.List;

public class EditorUserDto {
    public Long id;
    public String username;
    public String email;
    public UserStatus status;
    public String experience;
    public CategoryFieldDto field;
    public String references;
    public String phone;
    public List<EditorAttachmentDto> attachments;
}
