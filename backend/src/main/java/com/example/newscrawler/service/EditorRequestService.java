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
    private CategoryFieldRepository CategoryFieldRepository;

    @Autowired
    private CategoryFieldService CategoryFieldService;

    @Autowired
    private EditorUserRepository editorUserRepository;

    @Autowired
    private EditorAttachmentRepository editorAttachmentRepository;

    public EditorRequestResponse applyForEditor(String principalEmail, EditorApplicationRequest requestDto) {
        RegisteredUser user = registeredUserRepository.findByEmail(principalEmail)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Registered user not found"));

        if (requestDto.profilePicture == null || requestDto.profilePicture.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Profile picture is required");
        }

        CategoryField field = null;
        if (requestDto.fieldId != null) {
            field = CategoryFieldRepository.findById(requestDto.fieldId).orElse(null);
        }

        EditorRequest request = new EditorRequest();
        request.setUser(user);
        request.setExperience(requestDto.experience);
        request.setField(field);
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

@Autowired
    private EntityManager entityManager;

    @Transactional
    public void approveEditorRequest(Long id) {
        EditorRequest editorRequest = editorRequestRepository.findById(id)      
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found"));

        if (!"PENDING".equals(editorRequest.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request is not PENDING");
        }

        editorRequest.setStatus("APPROVED");
        editorRequestRepository.save(editorRequest);

        RegisteredUser user = editorRequest.getUser();
        String originalEmail = user.getEmail();

        if (editorUserRepository.findByEmail(originalEmail).isPresent()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Editor account already exists for this email");
        }

        // Suspend and archive the registered account so the editor account can keep the original email.
        user.setStatus(UserStatus.SUSPENDED);
        user.setEmail(archiveEmail(originalEmail, user.getId()));
        registeredUserRepository.saveAndFlush(user);

        // Create a new EditorUser record using the same original email and request details.
        EditorUser newEditorUser = new EditorUser();
        newEditorUser.setType(UserType.EDITOR);
        newEditorUser.setStatus(UserStatus.ACTIVE);

        newEditorUser.setUsername(user.getUsername());
        newEditorUser.setEmail(originalEmail);
        // Keep existing encrypted password so the user can sign in immediately as an editor.
        newEditorUser.setPassword(user.getPassword());

        newEditorUser.getRoles().add(UserRole.READ_ARTICLE);
        newEditorUser.getRoles().add(UserRole.MANAGE_OWN_PROFILE);
        newEditorUser.getRoles().add(UserRole.REACT_POST);
        newEditorUser.getRoles().add(UserRole.LEAVE_COMMENT);
        newEditorUser.getRoles().add(UserRole.REPORT_POST);
        newEditorUser.getRoles().add(UserRole.PUBLISH_LIVE_NEWS);
        newEditorUser.getRoles().add(UserRole.EDIT_LIVE_NEWS);
        newEditorUser.getRoles().add(UserRole.DELETE_LIVE_NEWS);

        newEditorUser.setExperience(editorRequest.getExperience());
        newEditorUser.setField(editorRequest.getField());
        newEditorUser.setReferences(editorRequest.getReferences());
        newEditorUser.setPhone(editorRequest.getPhone());
        newEditorUser.setProfilePicture(editorRequest.getProfilePicture());

        editorUserRepository.save(newEditorUser);

        for (EditorRequestAttachment reqAttachment : editorRequestAttachmentRepository.findByEditorRequestId(id)) {
            EditorAttachment attachment = new EditorAttachment();
            attachment.setEditorUser(newEditorUser);
            attachment.setFileName(reqAttachment.getFileName());
            attachment.setFileUrl(reqAttachment.getFileUrl());
            editorAttachmentRepository.save(attachment);
        }
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

    private String archiveEmail(String email, Long userId) {
        String safeId = userId == null ? "unknown" : userId.toString();
        String marker = ".suspended." + safeId;
        int at = email.indexOf('@');
        if (at < 0) {
            return email + marker;
        }
        return email.substring(0, at) + marker + email.substring(at);
    }

    private EditorRequestResponse mapToDto(EditorRequest request) {
        if (request == null) return null;
        EditorRequestResponse dto = new EditorRequestResponse();
        dto.id = request.getId();
        if (request.getUser() != null) {
            dto.userId = request.getUser().getId();
            dto.userEmail = request.getUser().getEmail();
        }
        dto.field = CategoryFieldService.mapToDto(request.getField());
        dto.experience = request.getExperience();
        dto.phone = request.getPhone();
        dto.profilePicture = request.getProfilePicture();
        dto.status = request.getStatus();
        dto.references = request.getReferences();
        List<EditorRequestAttachment> attachments = editorRequestAttachmentRepository.findByEditorRequestId(request.getId());
        dto.attachments = attachments.stream().map(EditorRequestAttachment::getFileUrl).collect(Collectors.toList());
        return dto;
    }
}
