package com.example.newscrawler.service;

import com.example.newscrawler.dto.EditorApplicationRequest;
import com.example.newscrawler.dto.EditorRequestResponse;
import com.example.newscrawler.entity.*;
import com.example.newscrawler.repository.*;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class EditorRequestService {

    @Autowired
    private EditorRequestRepository editorRequestRepository;

    @Autowired
    private RegisteredUserRepository registeredUserRepository;

    @Autowired
    private EditorRequestAttachmentRepository editorRequestAttachmentRepository;

    @Autowired
    private CategoryFieldRepository categoryFieldRepository;

    @Autowired
    private CategoryFieldService categoryFieldService;

    @Autowired
    private EditorUserRepository editorUserRepository;

    @Autowired
    private EditorAttachmentRepository editorAttachmentRepository;

    @Autowired
    private EntityManager entityManager;

    public EditorRequestResponse applyForEditor(String principalEmail, EditorApplicationRequest requestDto) {
        RegisteredUser user = registeredUserRepository.findByEmail(principalEmail)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Registered user not found"));

        // Check for 3-day cooldown if user was previously rejected
        List<EditorRequest> userRequests = editorRequestRepository.findByUserEmail(principalEmail);
        EditorRequest latestRejected = null;
        for (EditorRequest req : userRequests) {
            if ("REJECTED".equals(req.getStatus())) {
                if (latestRejected == null || (req.getUpdatedAt() != null && 
                    (latestRejected.getUpdatedAt() == null || req.getUpdatedAt().isAfter(latestRejected.getUpdatedAt())))) {
                    latestRejected = req;
                }
            }
        }
        if (latestRejected != null && latestRejected.getUpdatedAt() != null) {
            Duration sinceRejection = Duration.between(latestRejected.getUpdatedAt(), LocalDateTime.now());
            long hoursRemaining = 72 - sinceRejection.toHours();
            if (hoursRemaining > 0) {
                long daysRemaining = hoursRemaining / 24;
                long hoursLeft = hoursRemaining % 24;
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Your previous application was rejected. You can apply again in " 
                    + daysRemaining + " day(s) and " + hoursLeft + " hour(s).");
            }
        }

        if (requestDto.profilePicture == null || requestDto.profilePicture.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Profile picture is required");
        }

        // Validate and fetch fields
        List<CategoryField> fields = new ArrayList<>();
        if (requestDto.fieldIds != null && !requestDto.fieldIds.isEmpty()) {
            if (requestDto.fieldIds.size() > 2) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You can select at most 2 fields of interest");
            }
            // Check all fields have the same parent (must be under one general category)
            Long commonParentId = null;
            for (Long fid : requestDto.fieldIds) {
                CategoryField f = categoryFieldRepository.findById(fid)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Field not found: " + fid));
                if (f.getParent() == null) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot select a general category as a field of interest");
                }
                if (commonParentId == null) {
                    commonParentId = f.getParent().getId();
                } else if (!commonParentId.equals(f.getParent().getId())) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "All selected fields must be under the same general category");
                }
                fields.add(f);
            }
        }

        EditorRequest request = new EditorRequest();
        request.setUser(user);
        request.setExperience(requestDto.experience);
        request.setFields(fields);
        request.setReferences(requestDto.references);
        request.setPhone(requestDto.phone);
        request.setProfilePicture(requestDto.profilePicture);
        request.setStatus("PENDING");

        EditorRequest saved = editorRequestRepository.save(request);
        if (requestDto.attachments != null) {
            for (String url : requestDto.attachments) {
                EditorRequestAttachment attachment = new EditorRequestAttachment();
                attachment.setEditorRequest(saved);
                attachment.setFileUrl(url);
                attachment.setFileName(url);
                editorRequestAttachmentRepository.save(attachment);
            }
        }

        return mapToDto(saved);
    }

    public List<EditorRequestResponse> getRequests(String email, String orderByField) {
        List<EditorRequest> requests;
        if (email != null && !email.isEmpty()) {
            requests = editorRequestRepository.findByUserEmail(email);
        } else if ("true".equalsIgnoreCase(orderByField)) {
            requests = editorRequestRepository.findAllOrderByFieldNameAsc();
        } else {
            requests = editorRequestRepository.findAll();
        }
        return requests.stream().map(this::mapToDto).collect(Collectors.toList());
    }

    public EditorRequestResponse getRequestById(Long id) {
        EditorRequest req = editorRequestRepository.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));
        return mapToDto(req);
    }

    @Transactional
    public void approveEditorRequest(Long id) {
        EditorRequest editorRequest = editorRequestRepository.findById(id)      
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));

        // Allow re-approval for recovery: if the request was already approved but still points
        // to a suspended user, we can fix the reference.
        if (!"PENDING".equals(editorRequest.getStatus()) && !"APPROVED".equals(editorRequest.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request is not PENDING");
        }

        // Only set status if not already APPROVED
        if (!"APPROVED".equals(editorRequest.getStatus())) {
            editorRequest.setStatus("APPROVED");
            editorRequestRepository.save(editorRequest);
        }

        RegisteredUser user = editorRequest.getUser();

        // If the editor already exists (re-approval after suspension), just update the request reference
        EditorUser existingEditor = editorUserRepository.findByEmail(user.getEmail()).orElse(null);
        if (existingEditor != null) {
            editorRequest.setUser(existingEditor);
            editorRequestRepository.save(editorRequest);

            for (EditorRequestAttachment reqAttachment : editorRequestAttachmentRepository.findByEditorRequestId(id)) {
                EditorAttachment attachment = new EditorAttachment();
                attachment.setEditorUser(existingEditor);
                attachment.setFileName(reqAttachment.getFileName());
                attachment.setFileUrl(reqAttachment.getFileUrl());
                editorAttachmentRepository.save(attachment);
            }
            return;
        }

        // Convert the existing RegisteredUser to an EditorUser in-place (same ID)
        // by inserting editor-specific data into the editor_users table with the same id.
        Long userId = user.getId();

        // Update the user type in the users table to EDITOR
        // Using native SQL to avoid JPA inheritance issues with changing the discriminator
        entityManager.createNativeQuery("UPDATE users SET type = 'EDITOR' WHERE id = ?")
            .setParameter(1, userId)
            .executeUpdate();

        // Insert editor-specific data into editor_users table with the SAME id
        entityManager.createNativeQuery(
            "INSERT INTO editor_users (id, experience, phone, reference_docs, profile_picture) VALUES (?, ?, ?, ?, ?)")
            .setParameter(1, userId)
            .setParameter(2, editorRequest.getExperience())
            .setParameter(3, editorRequest.getPhone())
            .setParameter(4, editorRequest.getReferences())
            .setParameter(5, editorRequest.getProfilePicture())
            .executeUpdate();

        // Add roles via native SQL to avoid collection issues
        entityManager.createNativeQuery(
            "DELETE FROM registered_user_roles WHERE registered_user_id = ?")
            .setParameter(1, userId)
            .executeUpdate();

        String[] editorRoles = {"READ_ARTICLE", "MANAGE_OWN_PROFILE", "REACT_POST", "LEAVE_COMMENT",
                                "REPORT_POST", "PUBLISH_LIVE_NEWS", "EDIT_LIVE_NEWS", "DELETE_LIVE_NEWS"};
        for (String role : editorRoles) {
            entityManager.createNativeQuery(
                "INSERT INTO registered_user_roles (registered_user_id, role) VALUES (?, ?)")
                .setParameter(1, userId)
                .setParameter(2, role)
                .executeUpdate();
        }

        // Handle editor fields association
        entityManager.createNativeQuery(
            "DELETE FROM editor_user_fields WHERE editor_user_id = ?")
            .setParameter(1, userId)
            .executeUpdate();

        for (CategoryField field : editorRequest.getFields()) {
            entityManager.createNativeQuery(
                "INSERT INTO editor_user_fields (editor_user_id, field_id) VALUES (?, ?)")
                .setParameter(1, userId)
                .setParameter(2, field.getId())
                .executeUpdate();
        }

        // Attachments
        for (EditorRequestAttachment reqAttachment : editorRequestAttachmentRepository.findByEditorRequestId(id)) {
            EditorAttachment attachment = new EditorAttachment();
            // Need to create an EditorUser reference for the attachment - use the same ID
            EditorUser editorRef = entityManager.getReference(EditorUser.class, userId);
            attachment.setEditorUser(editorRef);
            attachment.setFileName(reqAttachment.getFileName());
            attachment.setFileUrl(reqAttachment.getFileUrl());
            editorAttachmentRepository.save(attachment);
        }

        // Update the request to point to the editor (still same id)
        // Clean up the entity manager cache so JPA sees the updated user type
        entityManager.flush();
        entityManager.clear();
    }

    @Transactional
    public void rejectEditorRequest(Long id) {
        EditorRequest editorRequest = editorRequestRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));

        if (!"PENDING".equals(editorRequest.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request is not PENDING");
        }

        editorRequest.setStatus("REJECTED");
        editorRequestRepository.save(editorRequest);
    }

    @Transactional
    public void setEditorPassword(String originalRegisteredEmail, String newPassword) {
        EditorUser editorAccount = editorUserRepository.findByEmail(originalRegisteredEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Editor account not found"));

        editorAccount.setPassword(newPassword);
        editorAccount.setStatus(UserStatus.ACTIVE);
        editorUserRepository.save(editorAccount);
    }

    private EditorRequestResponse mapToDto(EditorRequest request) {
        if (request == null) return null;
        EditorRequestResponse dto = new EditorRequestResponse();
        dto.id = request.getId();
        if (request.getUser() != null) {
            dto.userId = request.getUser().getId();
            dto.userEmail = request.getUser().getEmail();
        }
        dto.fields = request.getFields().stream()
            .map(categoryFieldService::mapToDto)
            .collect(Collectors.toList());
        dto.experience = request.getExperience();
        dto.phone = request.getPhone();
        dto.profilePicture = request.getProfilePicture();
        dto.status = request.getStatus();
        dto.references = request.getReferences();
        dto.createdAt = request.getCreatedAt();
        dto.updatedAt = request.getUpdatedAt();
        List<EditorRequestAttachment> attachments = editorRequestAttachmentRepository.findByEditorRequestId(request.getId());
        dto.attachments = attachments.stream().map(EditorRequestAttachment::getFileUrl).collect(Collectors.toList());
        return dto;
    }
}