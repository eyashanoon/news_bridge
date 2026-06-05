package com.example.newscrawler.controller;

import com.example.newscrawler.dto.RegisteredUserDto;
import com.example.newscrawler.dto.EditorUserDto;
import com.example.newscrawler.entity.EditorUser;
import com.example.newscrawler.entity.RegisteredUser;
import com.example.newscrawler.repository.EditorUserRepository;
import com.example.newscrawler.repository.RegisteredUserRepository;
import com.example.newscrawler.service.EditorUserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

@RestController
@RequestMapping("/api/profile")
public class ProfileController {

    @Autowired
    private RegisteredUserRepository registeredUserRepository;

    @Autowired
    private EditorUserRepository editorUserRepository;

    @Autowired
    private EditorUserService editorUserService;

    @GetMapping
    public Object getMyProfile() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        if (email == null || email.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }

        // Try editor first
        EditorUser editor = editorUserRepository.findByEmail(email).orElse(null);
        if (editor != null) {
            return editorUserService.getEditorByEmail(email);
        }

        // Then registered user
        RegisteredUser user = registeredUserRepository.findByEmail(email)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        return mapRegisteredUser(user);
    }

    @GetMapping("/{username}")
    public Object getProfileByUsername(@PathVariable String username) {
        // Try registered user first
        RegisteredUser user = registeredUserRepository.findByUsername(username).orElse(null);
        if (user != null) {
            if (user instanceof EditorUser editor) {
                return editorUserService.getEditorByEmail(editor.getEmail());
            }
            return mapRegisteredUser(user);
        }

        // Try email lookup
        user = registeredUserRepository.findByEmail(username).orElse(null);
        if (user != null) {
            if (user instanceof EditorUser editor) {
                return editorUserService.getEditorByEmail(editor.getEmail());
            }
            return mapRegisteredUser(user);
        }

        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found");
    }

    @PutMapping
    public Object updateMyProfile(@RequestBody Map<String, Object> updates) {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        if (email == null || email.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        }

        EditorUser editor = editorUserRepository.findByEmail(email).orElse(null);
        if (editor != null) {
            if (updates.containsKey("profilePicture")) editor.setProfilePicture((String) updates.get("profilePicture"));
            editorUserRepository.save(editor);
            return editorUserService.getEditorByEmail(email);
        }

        RegisteredUser user = registeredUserRepository.findByEmail(email)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (updates.containsKey("fullName")) user.setFullName((String) updates.get("fullName"));
        if (updates.containsKey("bio")) user.setBio((String) updates.get("bio"));
        if (updates.containsKey("profilePicture")) user.setProfilePicture((String) updates.get("profilePicture"));

        registeredUserRepository.save(user);
        return mapRegisteredUser(user);
    }

    private RegisteredUserDto mapRegisteredUser(RegisteredUser user) {
        RegisteredUserDto dto = new RegisteredUserDto();
        dto.id = user.getId();
        dto.username = user.getUsername();
        dto.email = user.getEmail();
        dto.fullName = user.getFullName();
        dto.bio = user.getBio();
        dto.profilePicture = user.getProfilePicture();
        dto.status = user.getStatus();
        return dto;
    }
}