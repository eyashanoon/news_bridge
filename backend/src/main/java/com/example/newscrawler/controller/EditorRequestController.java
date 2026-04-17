package com.example.newscrawler.controller;

import com.example.newscrawler.dto.ActivateEditorRequest;
import com.example.newscrawler.dto.EditorApplicationRequest;
import com.example.newscrawler.dto.EditorRequestResponse;
import com.example.newscrawler.service.EditorRequestService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/editor-requests")
public class EditorRequestController {

    @Autowired
    private EditorRequestService editorRequestService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('CREATE_EDITOR_REQUEST')")
    public EditorRequestResponse applyForEditor(Authentication authentication, @RequestBody EditorApplicationRequest requestDto) {
        String principal = authentication.getName();
        return editorRequestService.applyForEditor(principal, requestDto);      
    }

    @GetMapping
    @PreAuthorize("hasRole('VIEW_EDITOR_REQUESTS')")
    public List<EditorRequestResponse> getRequests(@RequestParam(required = false) String email, @RequestParam(required = false) String orderByField) {
        return editorRequestService.getRequests(email, orderByField);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('VIEW_EDITOR_REQUESTS')")
    public EditorRequestResponse getRequestById(@PathVariable Long id) {        
        return editorRequestService.getRequestById(id);
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('APPROVE_EDITOR_REQUESTS')")
    public void approveEditorRequest(@PathVariable Long id) {
        editorRequestService.approveEditorRequest(id);
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasRole('APPROVE_EDITOR_REQUESTS')")
    public void rejectEditorRequest(@PathVariable Long id) {
        editorRequestService.rejectEditorRequest(id);
    }

    @PostMapping("/activate")
    @ResponseStatus(HttpStatus.OK)
    @PreAuthorize("hasRole('MANAGE_OWN_PROFILE')")
    public void activateEditorAccount(Authentication authentication, @RequestBody ActivateEditorRequest request) {
        String principal = authentication.getName(); // JWT extracts user email here
        editorRequestService.setEditorPassword(principal, passwordEncoder.encode(request.newPassword));

    }
}
