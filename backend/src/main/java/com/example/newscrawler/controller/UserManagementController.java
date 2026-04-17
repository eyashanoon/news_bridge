package com.example.newscrawler.controller;

import com.example.newscrawler.dto.EditorUserResponse;
import com.example.newscrawler.dto.RegisteredUserResponse;
import com.example.newscrawler.dto.UpdateUserRolesRequest;
import com.example.newscrawler.dto.UpdateUserStatusRequest;
import com.example.newscrawler.entity.EditorUser;
import com.example.newscrawler.entity.RegisteredUser;
import com.example.newscrawler.entity.UserRole;
import com.example.newscrawler.entity.UserStatus;
import com.example.newscrawler.entity.UserType;
import com.example.newscrawler.repository.AllowedRoleRepository;
import com.example.newscrawler.repository.EditorAttachmentRepository;
import com.example.newscrawler.repository.EditorUserRepository;
import com.example.newscrawler.repository.RegisteredUserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/manage")
public class UserManagementController {

    @Autowired
    private RegisteredUserRepository registeredUserRepository;

    @Autowired
    private EditorUserRepository editorUserRepository;

    @Autowired
    private AllowedRoleRepository allowedRoleRepository;

    @Autowired
    private EditorAttachmentRepository editorAttachmentRepository;

    @GetMapping("/registered-users")
    @PreAuthorize("hasRole('MANAGE_USERS')")
    public List<RegisteredUserResponse> listRegisteredUsers() {
        return registeredUserRepository.findAll().stream()
                .filter(u -> !(u instanceof EditorUser))
                .map(this::mapRegistered)
                .collect(Collectors.toList());
    }

    @GetMapping("/editor-users")
    @PreAuthorize("hasRole('MANAGE_USERS') or hasRole('VIEW_EDITOR_INFO')")
    public List<EditorUserResponse> listEditorUsers() {
        return editorUserRepository.findAll().stream()
                .map(this::mapEditor)
                .collect(Collectors.toList());
    }

    @PutMapping("/registered-users/{id}/roles")
    @PreAuthorize("hasRole('MANAGE_USERS')")
    public RegisteredUserResponse updateRegisteredRoles(@PathVariable Long id, @RequestBody UpdateUserRolesRequest request) {
        RegisteredUser user = registeredUserRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Registered user not found"));
        if (user instanceof EditorUser) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Target user is an editor, use editor endpoint");
        }
        user.setRoles(parseAndValidateRoles(request.roles, UserType.REGISTERED));
        return mapRegistered(registeredUserRepository.save(user));
    }

    @PutMapping("/editor-users/{id}/roles")
    @PreAuthorize("hasRole('MANAGE_USERS')")
    public EditorUserResponse updateEditorRoles(@PathVariable Long id, @RequestBody UpdateUserRolesRequest request) {
        EditorUser user = editorUserRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Editor user not found"));
        user.setRoles(parseAndValidateRoles(request.roles, UserType.EDITOR));
        return mapEditor(editorUserRepository.save(user));
    }

    @PutMapping("/registered-users/{id}/status")
    @PreAuthorize("hasRole('MANAGE_USERS')")
    public RegisteredUserResponse updateRegisteredStatus(@PathVariable Long id, @RequestBody UpdateUserStatusRequest request) {
        RegisteredUser user = registeredUserRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Registered user not found"));
        if (user instanceof EditorUser) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Target user is an editor, use editor endpoint");
        }
        user.setStatus(parseStatus(request.status));
        return mapRegistered(registeredUserRepository.save(user));
    }

    @PutMapping("/editor-users/{id}/status")
    @PreAuthorize("hasRole('MANAGE_USERS')")
    public EditorUserResponse updateEditorStatus(@PathVariable Long id, @RequestBody UpdateUserStatusRequest request) {
        EditorUser user = editorUserRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Editor user not found"));
        user.setStatus(parseStatus(request.status));
        return mapEditor(editorUserRepository.save(user));
    }

    @DeleteMapping("/registered-users/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('MANAGE_USERS')")
    public void deleteRegisteredUser(@PathVariable Long id) {
        RegisteredUser user = registeredUserRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Registered user not found"));
        if (user instanceof EditorUser) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Target user is an editor, use editor endpoint");
        }
        registeredUserRepository.delete(user);
    }

    @DeleteMapping("/editor-users/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('MANAGE_USERS')")
    public void deleteEditorUser(@PathVariable Long id) {
        EditorUser user = editorUserRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Editor user not found"));
        editorUserRepository.delete(user);
    }

    private UserStatus parseStatus(String status) {
        try {
            return UserStatus.valueOf(status);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status: " + status);
        }
    }

    private Set<UserRole> parseAndValidateRoles(List<String> roles, UserType userType) {
        Set<UserRole> userRoles = new HashSet<>();
        if (roles == null) {
            return userRoles;
        }
        for (String roleStr : roles) {
            UserRole role;
            try {
                role = UserRole.valueOf(roleStr);
            } catch (IllegalArgumentException ex) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid role: " + roleStr);
            }

            if (!allowedRoleRepository.existsByUserTypeAndRole(userType, role)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Role not allowed for " + userType.name() + ": " + roleStr);
            }
            userRoles.add(role);
        }
        return userRoles;
    }

    private RegisteredUserResponse mapRegistered(RegisteredUser u) {
        RegisteredUserResponse r = new RegisteredUserResponse();
        r.id = u.getId();
        r.username = u.getUsername();
        r.email = u.getEmail();
        r.type = u.getType() != null ? u.getType().name() : "REGISTERED";
        r.status = u.getStatus() != null ? u.getStatus().name() : null;
        r.active = u.getStatus() == UserStatus.ACTIVE;
        r.roles = u.getRoles().stream().map(Enum::name).collect(Collectors.toSet());
        return r;
    }

    private EditorUserResponse mapEditor(EditorUser u) {
        EditorUserResponse r = new EditorUserResponse();
        r.id = u.getId();
        r.username = u.getUsername();
        r.email = u.getEmail();
        r.type = u.getType() != null ? u.getType().name() : "EDITOR";
        r.status = u.getStatus() != null ? u.getStatus().name() : null;
        r.active = u.getStatus() == UserStatus.ACTIVE;
        r.roles = u.getRoles().stream().map(Enum::name).collect(Collectors.toSet());
        r.fieldName = u.getField() != null ? u.getField().getName() : null;
        r.phone = u.getPhone();
        r.profilePicture = u.getProfilePicture();
        r.experience = u.getExperience();
        r.references = u.getReferences();
        r.attachments = editorAttachmentRepository.findByEditorUserId(u.getId())
            .stream()
            .map(a -> a.getFileUrl())
            .collect(Collectors.toList());
        return r;
    }
}
