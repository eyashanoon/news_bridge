package com.example.newscrawler.service;

import com.example.newscrawler.dto.EditorAttachmentDto;
import com.example.newscrawler.dto.EditorUserDto;
import com.example.newscrawler.dto.UpdateEditorProfileRequest;
import com.example.newscrawler.entity.CategoryField;
import com.example.newscrawler.entity.EditorAttachment;
import com.example.newscrawler.entity.EditorUser;
import com.example.newscrawler.entity.UserStatus;
import com.example.newscrawler.repository.EditorAttachmentRepository;
import com.example.newscrawler.repository.EditorUserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class EditorUserService {

    @Autowired
    private EditorUserRepository editorUserRepository;

    @Autowired
    private EditorAttachmentRepository editorAttachmentRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private CategoryFieldService categoryFieldService;

    public List<EditorUserDto> getAllEditors() {
        return editorUserRepository.findAll().stream().map(this::mapToDto).collect(Collectors.toList());
    }

    public EditorUserDto getEditorById(Long id) {
        EditorUser editor = editorUserRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Editor not found"));
        return mapToDto(editor);
    }

    public EditorUserDto getEditorByEmail(String email) {
        EditorUser editor = editorUserRepository.findByEmail(email)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Editor not found"));
        return mapToDto(editor);
    }

    @Transactional
    public EditorUserDto updateEditorProfile(String email, UpdateEditorProfileRequest request) {
        EditorUser editor = editorUserRepository.findByEmail(email)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Editor not found"));

        if (request.phone != null && !request.phone.isEmpty()) {
            editor.setPhone(request.phone);
        }

        if (request.password != null && !request.password.isEmpty()) {
            editor.setPassword(passwordEncoder.encode(request.password));
        }

        if (request.newAttachments != null && !request.newAttachments.isEmpty()) {
            for (EditorAttachmentDto att : request.newAttachments) {
                EditorAttachment attachment = new EditorAttachment();
                attachment.setEditorUser(editor);
                attachment.setFileName(att.fileName);
                attachment.setFileUrl(att.fileUrl);
                editorAttachmentRepository.save(attachment);
            }
        }

        return mapToDto(editorUserRepository.save(editor));
    }

    @Transactional
    public void suspendEditor(Long id) {
        EditorUser editor = editorUserRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Editor not found"));
        
        editor.setStatus(UserStatus.SUSPENDED);
        editorUserRepository.save(editor);
    }

    private EditorUserDto mapToDto(EditorUser user) {
        EditorUserDto dto = new EditorUserDto();
        dto.id = user.getId();
        dto.username = user.getUsername();
        dto.email = user.getEmail();
        dto.status = user.getStatus();
        dto.experience = user.getExperience();
        dto.references = user.getReferences();
        dto.phone = user.getPhone();
        dto.field = categoryFieldService.mapToDto(user.getField());
        
        List<EditorAttachment> attachments = editorAttachmentRepository.findByEditorUserId(user.getId());
        dto.attachments = attachments.stream().map(a -> {
            EditorAttachmentDto d = new EditorAttachmentDto();
            d.id = a.getId();
            d.fileName = a.getFileName();
            d.fileUrl = a.getFileUrl();
            return d;
        }).collect(Collectors.toList());
        
        return dto;
    }
}
