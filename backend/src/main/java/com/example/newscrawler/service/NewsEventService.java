package com.example.newscrawler.service;

import com.example.newscrawler.dto.*;
import com.example.newscrawler.entity.*;
import com.example.newscrawler.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
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
    @Autowired private TopicService topicService;

    // ─── Admin: create ────────────────────────────────────────────────────────

    @Transactional
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

        NewsEventResponse response = mapToDto(eventRepository.save(event));

        // If the event is PUBLIC from the start, create a corresponding topic
        if ("PUBLIC".equals(event.getStatus())) {
            createTopicFromEvent(event);
        }

        return response;
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
        if (editor.getFields() == null || editor.getFields().isEmpty()) return List.of();
        // Get events matching any of the editor's fields
        CategoryField firstField = editor.getFields().get(0);
        return eventRepository.findByFieldAndStatusIn(
                firstField, List.of("EDITOR_VISIBLE", "PUBLIC"))
                .stream().map(this::mapToDto).collect(Collectors.toList());
    }

    // ─── Get single event ─────────────────────────────────────────────────────

    public NewsEventResponse getEvent(Long id) {
        return mapToDto(findEvent(id));
    }

    // ─── Admin: update ────────────────────────────────────────────────────────

    @Transactional
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
        NewsEventResponse response = mapToDto(eventRepository.save(event));

        // If the event is PUBLIC after update, create a corresponding topic
        if ("PUBLIC".equals(event.getStatus())) {
            createTopicFromEvent(event);
        }

        return response;
    }

    // ─── Admin: change status ─────────────────────────────────────────────────

    @Transactional
    public NewsEventResponse changeStatus(Long id, String status) {
        NewsEvent event = findEvent(id);
        event.setStatus(status);
        NewsEventResponse response = mapToDto(eventRepository.save(event));

        // If the event transitions to PUBLIC, create a corresponding topic
        if ("PUBLIC".equals(event.getStatus())) {
            createTopicFromEvent(event);
        }

        return response;
    }

    // ─── Admin: delete ────────────────────────────────────────────────────────

    @Transactional
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

        // Check field match (at least one editor field must match event field)
        if (editor.getFields() == null || editor.getFields().isEmpty() ||
            editor.getFields().stream().noneMatch(f -> f.getId().equals(event.getField().getId()))) {
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

    /**
     * Create a Topic from a NewsEvent so it appears in the Trending Topics page.
     * This is called automatically when an event's status is set to PUBLIC.
     * If a Topic with a matching title already exists, it is skipped to avoid duplicates.
     */
    private void createTopicFromEvent(NewsEvent event) {
        try {
            // Check if a topic with this title already exists (avoid duplicates)
            boolean exists = topicService.getAllActiveTopics().stream()
                .anyMatch(t -> t.title != null && t.title.equals(event.getTitle()));
            if (exists) {
                return;
            }

            // Build field IDs list from the event's field
            List<Long> fieldIds = event.getField() != null
                ? List.of(event.getField().getId())
                : List.of();

            CreateTopicRequest request = new CreateTopicRequest();
            request.title = event.getTitle();
            request.description = event.getDescription();
            request.author = "News Bridge";
            request.imageUrl = null;
            request.tags = List.of("live", "event");
            request.fieldIds = fieldIds;

            topicService.createTopic(request, event.getCreatedByEmail() != null ? event.getCreatedByEmail() : "system@newsbridge.app");
        } catch (Exception e) {
            // Log but don't fail the event status change
            System.err.println("Failed to create topic from event " + event.getId() + ": " + e.getMessage());
        }
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