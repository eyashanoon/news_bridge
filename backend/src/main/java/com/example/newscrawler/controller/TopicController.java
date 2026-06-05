package com.example.newscrawler.controller;

import com.example.newscrawler.dto.*;
import com.example.newscrawler.entity.EditorUser;
import com.example.newscrawler.entity.RegisteredUser;
import com.example.newscrawler.entity.UserRole;
import com.example.newscrawler.repository.EditorUserRepository;
import com.example.newscrawler.repository.RegisteredUserRepository;
import com.example.newscrawler.service.TopicEditorService;
import com.example.newscrawler.service.TopicService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/topics")
public class TopicController {

    private final TopicService topicService;
    private final TopicEditorService topicEditorService;
    private final EditorUserRepository editorUserRepository;
    private final RegisteredUserRepository registeredUserRepository;

    public TopicController(TopicService topicService,
                           TopicEditorService topicEditorService,
                           EditorUserRepository editorUserRepository,
                           RegisteredUserRepository registeredUserRepository) {
        this.topicService = topicService;
        this.topicEditorService = topicEditorService;
        this.editorUserRepository = editorUserRepository;
        this.registeredUserRepository = registeredUserRepository;
    }

    // ─── Public: Get all topics (visible to everyone, same as admin view) ───

    @GetMapping
    public ResponseEntity<List<TopicResponse>> getAllTopics() {
        return ResponseEntity.ok(topicService.getAllTopics());
    }

    // ─── Get single topic by id ──────────────────────────────────────────────

    @GetMapping("/{id}")
    public ResponseEntity<TopicResponse> getTopic(@PathVariable Long id) {
        return ResponseEntity.ok(topicService.getTopicById(id));
    }

    // ─── Admin: create topic ─────────────────────────────────────────────────

    @PostMapping
    @PreAuthorize("hasRole('MANAGE_USERS') or hasRole('MANAGE_EVENTS')")
    @ResponseStatus(HttpStatus.CREATED)
    public TopicResponse createTopic(@RequestBody CreateTopicRequest request,
                                      Authentication authentication) {
        String adminEmail = authentication.getName();
        return topicService.createTopic(request, adminEmail);
    }

    // ─── Admin: update topic ─────────────────────────────────────────────────

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('MANAGE_USERS') or hasRole('MANAGE_EVENTS')")
    public TopicResponse updateTopic(@PathVariable Long id,
                                     @RequestBody CreateTopicRequest request) {
        return topicService.updateTopic(id, request);
    }

    // ─── Admin: change topic status (DRAFT → ACTIVE → INACTIVE) ─────────────

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('MANAGE_USERS') or hasRole('MANAGE_EVENTS')")
    public TopicResponse changeStatus(@PathVariable Long id,
                                      @RequestBody Map<String, String> body) {
        return topicService.changeTopicStatus(id, body.get("status"));
    }

    // ─── Admin: delete topic ─────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('MANAGE_USERS') or hasRole('MANAGE_EVENTS')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTopic(@PathVariable Long id) {
        topicService.deleteTopic(id);
    }

    // ─── Get posts for a topic ───────────────────────────────────────────────

    @GetMapping("/{id}/posts")
    public ResponseEntity<List<TopicPostResponse>> getTopicPosts(@PathVariable Long id) {
        return ResponseEntity.ok(topicService.getPostsByTopic(id));
    }

    // ─── Editor: create post in a topic ──────────────────────────────────────

    @PostMapping("/{id}/posts")
    @PreAuthorize("hasRole('PUBLISH_LIVE_NEWS') or hasRole('EDIT_LIVE_NEWS') or hasRole('LEAVE_COMMENT') or hasRole('REACT_POST')")
    @ResponseStatus(HttpStatus.CREATED)
    public TopicPostResponse createTopicPost(
            @PathVariable Long id,
            @RequestBody CreateTopicPostRequest request,
            Authentication authentication) {
        String email = authentication.getName();
        String name = email; // fallback to email

        // Try to get the editor's display name
        EditorUser editor = editorUserRepository.findByEmail(email).orElse(null);
        if (editor != null) {
            name = editor.getUsername() != null ? editor.getUsername() : email;
        } else {
            // Try registered user
            RegisteredUser user = registeredUserRepository.findByEmail(email).orElse(null);
            if (user != null) {
                name = user.getUsername() != null ? user.getUsername() : email;
            }
        }

        Long editorId = editor != null ? editor.getId() : null;
        return topicService.createPost(id, request, email, name, editorId);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Topic Editor Assignment Endpoints
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Editor requests to post to a topic (field match required).
     * Access is checked by verifying the user is an editor with PUBLISH_LIVE_NEWS or EDIT_LIVE_NEWS role
     * from the database (not from the JWT token, since the token may have been issued before editor approval).
     */
    @PostMapping("/{topicId}/request")
    public TopicAssignmentResponse requestToPost(
            @PathVariable Long topicId,
            Authentication authentication) {
        String email = authentication.getName();
        EditorUser editor = editorUserRepository.findByEmail(email)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Editor not found"));

        // Check editor has the required roles (from DB, not JWT)
        boolean canPost = editor.getRoles().contains(UserRole.PUBLISH_LIVE_NEWS) ||
                          editor.getRoles().contains(UserRole.EDIT_LIVE_NEWS);
        if (!canPost) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You do not have permission to post to topics");
        }

        return topicEditorService.requestToPost(topicId, editor.getId());
    }

    /**
     * Admin approves an editor's request to post to a topic.
     */
    @PostMapping("/{topicId}/approve/{editorId}")
    @PreAuthorize("hasRole('MANAGE_USERS') or hasRole('MANAGE_EVENTS')")
    public TopicAssignmentResponse approveEditor(
            @PathVariable Long topicId,
            @PathVariable Long editorId,
            Authentication authentication) {
        String adminName = authentication.getName();
        return topicEditorService.approveEditor(topicId, editorId, adminName);
    }

    /**
     * Admin rejects an editor's request to post to a topic.
     */
    @PostMapping("/{topicId}/reject/{editorId}")
    @PreAuthorize("hasRole('MANAGE_USERS') or hasRole('MANAGE_EVENTS')")
    public TopicAssignmentResponse rejectEditor(
            @PathVariable Long topicId,
            @PathVariable Long editorId,
            Authentication authentication) {
        String adminName = authentication.getName();
        return topicEditorService.rejectEditor(topicId, editorId, adminName);
    }

    /**
     * Admin manually assigns an editor to a topic (no request needed).
     */
    @PostMapping("/{topicId}/assign/{editorId}")
    @PreAuthorize("hasRole('MANAGE_USERS') or hasRole('MANAGE_EVENTS')")
    public TopicAssignmentResponse assignEditor(
            @PathVariable Long topicId,
            @PathVariable Long editorId,
            Authentication authentication) {
        String adminName = authentication.getName();
        return topicEditorService.assignEditor(topicId, editorId, adminName);
    }

    /**
     * Get all assignments for a topic (admin view).
     */
    @GetMapping("/{topicId}/editors")
    @PreAuthorize("hasRole('MANAGE_USERS') or hasRole('MANAGE_EVENTS')")
    public List<TopicAssignmentResponse> getTopicEditors(@PathVariable Long topicId) {
        return topicEditorService.getAssignmentsForTopic(topicId);
    }

    /**
     * Get the current editor's assignments for all topics.
     * Role check is done from DB (not JWT) since JWT may have stale roles.
     */
    @GetMapping("/my-assignments")
    public List<TopicAssignmentResponse> getMyAssignments(Authentication authentication) {
        String email = authentication.getName();
        EditorUser editor = editorUserRepository.findByEmail(email)
            .orElse(null);
        if (editor == null) {
            return List.of(); // Return empty list for non-editors instead of throwing error
        }
        return topicEditorService.getAssignmentsForEditor(editor.getId());
    }

    /**
     * Get topics for editors (ACTIVE + DRAFT topics matching their field).
     * Role check is done from DB (not JWT) since JWT may have stale roles.
     */
    @GetMapping("/my-topics")
    public List<TopicResponse> getMyTopics(Authentication authentication) {
        String email = authentication.getName();
        EditorUser editor = editorUserRepository.findByEmail(email)
            .orElse(null);
        if (editor == null) {
            return List.of(); // Return empty list for non-editors
        }
        List<Long> fieldIds = editor.getFields() != null
            ? editor.getFields().stream().map(f -> f.getId()).collect(java.util.stream.Collectors.toList())
            : List.of();
        return topicService.getTopicsForEditor(email, fieldIds);
    }
}