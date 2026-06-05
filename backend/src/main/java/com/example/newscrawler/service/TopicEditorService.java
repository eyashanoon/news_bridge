package com.example.newscrawler.service;

import com.example.newscrawler.dto.TopicAssignmentResponse;
import com.example.newscrawler.entity.*;
import com.example.newscrawler.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class TopicEditorService {

    @Autowired
    private TopicEditorRepository topicEditorRepository;

    @Autowired
    private TopicRepository topicRepository;

    @Autowired
    private EditorUserRepository editorUserRepository;

    /**
     * Editor requests to post to a topic.
     * Validates that the editor's fields match at least one of the topic's fields.
     */
    @Transactional
    public TopicAssignmentResponse requestToPost(Long topicId, Long editorId) {
        Topic topic = topicRepository.findById(topicId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Topic not found"));

        EditorUser editor = editorUserRepository.findById(editorId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Editor not found"));

        // Check if already has an assignment
        Optional<TopicEditorAssignment> existing = topicEditorRepository.findByTopicIdAndEditorId(topicId, editorId);
        if (existing.isPresent()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "You already have a " + existing.get().getStatus() + " request for this topic");
        }

        // Validate field match: at least one editor field must match one topic field
        if (!fieldsMatch(editor, topic)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Your field interests don't match this event");
        }

        TopicEditorAssignment assignment = new TopicEditorAssignment();
        assignment.setTopic(topic);
        assignment.setEditor(editor);
        assignment.setStatus("REQUESTED");

        assignment = topicEditorRepository.save(assignment);
        return mapToDto(assignment);
    }

    /**
     * Admin approves an editor's request to post to a topic.
     */
    @Transactional
    public TopicAssignmentResponse approveEditor(Long topicId, Long editorId, String adminName) {
        TopicEditorAssignment assignment = findAssignmentOrThrow(topicId, editorId);
        if (!"REQUESTED".equals(assignment.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Editor request is not in REQUESTED status");
        }
        assignment.setStatus("APPROVED");
        assignment.setAssignedBy(adminName);
        assignment = topicEditorRepository.save(assignment);
        return mapToDto(assignment);
    }

    /**
     * Admin rejects an editor's request to post to a topic.
     */
    @Transactional
    public TopicAssignmentResponse rejectEditor(Long topicId, Long editorId, String adminName) {
        TopicEditorAssignment assignment = findAssignmentOrThrow(topicId, editorId);
        if (!"REQUESTED".equals(assignment.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Editor request is not in REQUESTED status");
        }
        assignment.setStatus("REJECTED");
        assignment.setAssignedBy(adminName);
        assignment = topicEditorRepository.save(assignment);
        return mapToDto(assignment);
    }

    /**
     * Admin manually assigns an editor to a topic (no application needed).
     */
    @Transactional
    public TopicAssignmentResponse assignEditor(Long topicId, Long editorId, String adminName) {
        Topic topic = topicRepository.findById(topicId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Topic not found"));

        EditorUser editor = editorUserRepository.findById(editorId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Editor not found"));

        // Check if already has an assignment
        Optional<TopicEditorAssignment> existing = topicEditorRepository.findByTopicIdAndEditorId(topicId, editorId);
        if (existing.isPresent()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Editor already has a " + existing.get().getStatus() + " assignment for this topic");
        }

        // Validate field match
        if (!fieldsMatch(editor, topic)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Editor's fields don't match this event");
        }

        TopicEditorAssignment assignment = new TopicEditorAssignment();
        assignment.setTopic(topic);
        assignment.setEditor(editor);
        assignment.setStatus("ASSIGNED");
        assignment.setAssignedBy(adminName);

        assignment = topicEditorRepository.save(assignment);
        return mapToDto(assignment);
    }

    /**
     * Get all assignments for a topic (admin view).
     */
    public List<TopicAssignmentResponse> getAssignmentsForTopic(Long topicId) {
        return topicEditorRepository.findByTopicId(topicId).stream()
            .map(this::mapToDto)
            .collect(Collectors.toList());
    }

    /**
     * Get all assignments for an editor (for the editor to see their statuses).
     */
    public List<TopicAssignmentResponse> getAssignmentsForEditor(Long editorId) {
        return topicEditorRepository.findByEditorId(editorId).stream()
            .map(this::mapToDto)
            .collect(Collectors.toList());
    }

    /**
     * Get the status of an editor's assignment for a specific topic.
     * Returns null if no assignment exists.
     */
    public String getAssignmentStatus(Long topicId, Long editorId) {
        return topicEditorRepository.findByTopicIdAndEditorId(topicId, editorId)
            .map(TopicEditorAssignment::getStatus)
            .orElse(null);
    }

    /**
     * Check if an editor can post to a topic.
     * Both field match AND approved/assigned status must be true.
     */
    public boolean canEditorPost(Long topicId, Long editorId) {
        // Field match check
        Topic topic = topicRepository.findById(topicId).orElse(null);
        EditorUser editor = editorUserRepository.findById(editorId).orElse(null);
        if (topic == null || editor == null) return false;
        if (!fieldsMatch(editor, topic)) return false;

        // Assignment status check
        Optional<TopicEditorAssignment> assignment = topicEditorRepository.findByTopicIdAndEditorId(topicId, editorId);
        return assignment.isPresent() && 
               ("APPROVED".equals(assignment.get().getStatus()) || "ASSIGNED".equals(assignment.get().getStatus()));
    }

    /**
     * Check if editor's fields match at least one of the topic's fields.
     */
    public boolean fieldsMatch(EditorUser editor, Topic topic) {
        Set<Long> editorFieldIds = editor.getFields().stream()
            .map(CategoryField::getId)
            .collect(Collectors.toSet());
        Set<Long> topicFieldIds = topic.getFields().stream()
            .map(CategoryField::getId)
            .collect(Collectors.toSet());

        // At least one editor field must match one topic field
        for (Long efid : editorFieldIds) {
            if (topicFieldIds.contains(efid)) {
                return true;
            }
        }
        return false;
    }

    private TopicEditorAssignment findAssignmentOrThrow(Long topicId, Long editorId) {
        return topicEditorRepository.findByTopicIdAndEditorId(topicId, editorId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Assignment not found"));
    }

    private TopicAssignmentResponse mapToDto(TopicEditorAssignment assignment) {
        TopicAssignmentResponse dto = new TopicAssignmentResponse();
        dto.id = assignment.getId();
        dto.topicId = assignment.getTopic().getId();
        dto.topicTitle = assignment.getTopic().getTitle();
        dto.editorId = assignment.getEditor().getId();
        dto.editorEmail = assignment.getEditor().getEmail();
        dto.editorName = assignment.getEditor().getUsername() != null ? assignment.getEditor().getUsername() : assignment.getEditor().getEmail();
        dto.status = assignment.getStatus();
        dto.assignedBy = assignment.getAssignedBy();
        dto.createdAt = assignment.getCreatedAt();
        return dto;
    }
}