package com.example.newscrawler.controller;

import com.example.newscrawler.dto.EditorUserDto;
import com.example.newscrawler.dto.UpdateEditorProfileRequest;
import com.example.newscrawler.service.EditorUserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users/editor")
public class EditorUserController {

    @Autowired
    private EditorUserService editorUserService;

    @GetMapping
    @PreAuthorize("hasRole('VIEW_EDITOR_INFO') or hasRole('MANAGE_USERS')")    
    public List<EditorUserDto> getAllEditors() {
        return editorUserService.getAllEditors();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('VIEW_EDITOR_INFO') or hasRole('MANAGE_USERS')")    
    public EditorUserDto getEditorById(@PathVariable Long id) {
        return editorUserService.getEditorById(id);
    }

    @GetMapping("/me")
    public EditorUserDto getMe() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return editorUserService.getEditorByEmail(email);
    }

    @PutMapping("/me")
    public EditorUserDto updateMyProfile(@RequestBody UpdateEditorProfileRequest request) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        return editorUserService.updateEditorProfile(email, request);
    }

    @PostMapping("/{id}/suspend")
    @PreAuthorize("hasRole('SUSPEND_EDITOR') or hasRole('MANAGE_USERS')")      
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void suspendEditor(@PathVariable Long id) {
        editorUserService.suspendEditor(id);
    }
}
