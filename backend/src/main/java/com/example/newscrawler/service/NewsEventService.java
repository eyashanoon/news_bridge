package com.example.newscrawler.service;

import com.example.newscrawler.dto.*;
import com.example.newscrawler.entity.*;
import com.example.newscrawler.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class NewsEventService {

    @Autowired private NewsEventRepository eventRepository;
    @Autowired private CategoryFieldRepository fieldRepository;
    @Autowired private PublishPermissionRequestRepository permissionRepository;
    @Autowired private EditorUserRepository editorUserRepository;

    // ─── Admin: create ────────────────────────────────────────────────────────

    public NewsEventResponse createEvent(CreateNewsEventRequest req, String adminEmail) {
        if (req.title == null || req.title.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Event title is required");
        }
        if (req.fieldId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Field is required");
        }
        CategoryField field = fieldRepository.findById(req.fieldId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Field not found"));

        NewsEvent event = new NewsEvent();
        event.setTitle(req.title);
        event.setDescription(req.description);
        event.setField(field);
        event.setStatus(req.status != null ? req.status : "DRAFT");
        event.setCreatedByEmail(adminEmail);

        return mapToDto(eventRepository.save(event));
    }

    // ─── Admin: list all ─────────────────────────────────────────────────────

    public List<NewsEventResponse> getAllEvents() {
        return eventRepository.findAll().stream().map(this::mapToDto).collect(Collectors.toList());
    }

    // ─── Public: list PUBLIC events ──────────────────────────────────────────

    public List<NewsEventResponse> getPublicEvents() {
        return eventRepository.findByStatus("PUBLIC").stream().map(this::mapToDto).collect(Collectors.toList());
    }

    // ─── Editor: list events for their field (EDITOR_VISIBLE + PUBLIC) ───────

    public List<NewsEventResponse> getEventsForEditor(String editorEmail) {
        EditorUser editor = editorUserRepository.findByEmail(editorEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Editor not found"));
        if (editor.getField() == null) return List.of();
        return eventRepository.findByFieldAndStatusIn(
                editor.getField(), List.of("EDITOR_VISIBLE", "PUBLIC"))
                .stream().map(this::mapToDto).collect(Collectors.toList());
    }

    // ─── Get single event ─────────────────────────────────────────────────────

    public NewsEventResponse getEvent(Long id) {
        return mapToDto(findEvent(id));
    }

    // ─── Admin: update ────────────────────────────────────────────────────────

    public NewsEventResponse updateEvent(Long id, CreateNewsEventRequest req) {
        NewsEvent event = findEvent(id);
        if (req.title != null && !req.title.isBlank()) event.setTitle(req.title);
        if (req.description != null) event.setDescription(req.description);
        if (req.status != null) event.setStatus(req.status);
        if (req.fieldId != null) {
            CategoryField field = fieldRepository.findById(req.fieldId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Field not found"));
            event.setField(field);
        }
        return mapToDto(eventRepository.save(event));
    }

    // ─── Admin: change status ─────────────────────────────────────────────────

    public NewsEventResponse changeStatus(Long id, String status) {
        NewsEvent event = findEvent(id);
        event.setStatus(status);
        return mapToDto(eventRepository.save(event));
    }

    // ─── Admin: delete ────────────────────────────────────────────────────────

    public void deleteEvent(Long id) {
        NewsEvent event = findEvent(id);
        eventRepository.delete(event);
    }

    // ─── Editor: request publish permission ──────────────────────────────────

    public PublishRequestResponse requestPublishPermission(Long eventId, String editorEmail) {
        NewsEvent event = findEvent(eventId);
        if ("DRAFT".equals(event.getStatus())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This event is not open for publish requests yet");
        }
        EditorUser editor = editorUserRepository.findByEmail(editorEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Editor profile not found"));

        // Check field match
        if (editor.getField() == null || !editor.getField().getId().equals(event.getField().getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not in the field for this event");
        }

        // No duplicate requests
        if (permissionRepository.existsByEventAndEditorAndStatus(event, editor, "PENDING") ||
            permissionRepository.existsByEventAndEditorAndStatus(event, editor, "APPROVED")) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Request already exists for this event");
        }

        PublishPermissionRequest req = new PublishPermissionRequest();
        req.setEvent(event);
        req.setEditor(editor);
        req.setStatus("PENDING");

        return mapPermToDto(permissionRepository.save(req));
    }

    // ─── Admin: list publish requests for an event ────────────────────────────

    public List<PublishRequestResponse> getPublishRequests(Long eventId) {
        NewsEvent event = findEvent(eventId);
        return permissionRepository.findByEvent(event).stream().map(this::mapPermToDto).collect(Collectors.toList());
    }

    // ─── Editor: list own publish requests ───────────────────────────────────

    public List<PublishRequestResponse> getMyPublishRequests(String editorEmail) {
        EditorUser editor = editorUserRepository.findByEmail(editorEmail)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Editor not found"));
        return permissionRepository.findByEditor(editor).stream().map(this::mapPermToDto).collect(Collectors.toList());
    }

    // ─── Admin: approve / reject ──────────────────────────────────────────────

    public PublishRequestResponse reviewPublishRequest(Long requestId, boolean approve, String adminEmail) {
        PublishPermissionRequest req = permissionRepository.findById(requestId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Publish request not found"));
        req.setStatus(approve ? "APPROVED" : "REJECTED");
        req.setReviewedAt(Instant.now());
        req.setReviewedByEmail(adminEmail);
        return mapPermToDto(permissionRepository.save(req));
    }

    // ─── Check if editor is approved for event ───────────────────────────────

    public boolean isEditorApproved(Long eventId, String editorEmail) {
        EditorUser editor = editorUserRepository.findByEmail(editorEmail).orElse(null);
        if (editor == null) return false;
        NewsEvent event = eventRepository.findById(eventId).orElse(null);
        if (event == null) return false;
        return permissionRepository.existsByEventAndEditorAndStatus(event, editor, "APPROVED");
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private NewsEvent findEvent(Long id) {
        return eventRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Event not found"));
    }

    public NewsEventResponse mapToDto(NewsEvent event) {
        NewsEventResponse dto = new NewsEventResponse();
        dto.id = event.getId();
        dto.title = event.getTitle();
        dto.description = event.getDescription();
        dto.status = event.getStatus();
        dto.createdByEmail = event.getCreatedByEmail();
        dto.createdAt = event.getCreatedAt();
        dto.updatedAt = event.getUpdatedAt();
        if (event.getField() != null) {
            CategoryFieldDto fieldDto = new CategoryFieldDto();
            fieldDto.id = event.getField().getId();
            fieldDto.name = event.getField().getName();
            fieldDto.description = event.getField().getDescription();
            dto.field = fieldDto;
        }
        return dto;
    }

    public PublishRequestResponse mapPermToDto(PublishPermissionRequest req) {
        PublishRequestResponse dto = new PublishRequestResponse();
        dto.id = req.getId();
        dto.eventId = req.getEvent().getId();
        dto.eventTitle = req.getEvent().getTitle();
        dto.editorId = req.getEditor().getId();
        dto.editorEmail = req.getEditor().getEmail();
        dto.editorName = req.getEditor().getUsername();
        dto.status = req.getStatus();
        dto.requestedAt = req.getRequestedAt();
        dto.reviewedAt = req.getReviewedAt();
        dto.reviewedByEmail = req.getReviewedByEmail();
        return dto;
    }
}
