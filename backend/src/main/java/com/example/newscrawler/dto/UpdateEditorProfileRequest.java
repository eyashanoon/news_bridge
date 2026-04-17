package com.example.newscrawler.dto;

import java.util.List;

public class UpdateEditorProfileRequest {
    public String password;
    public String phone;
    public List<EditorAttachmentDto> newAttachments;
}
