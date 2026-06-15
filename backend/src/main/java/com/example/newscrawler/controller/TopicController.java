package com.example.newscrawler.controller;

import com.example.newscrawler.dto.*;
import com.example.newscrawler.entity.AppUser;
import com.example.newscrawler.entity.EditorUser;
import com.example.newscrawler.entity.ReactionType;
import com.example.newscrawler.entity.RegisteredUser;
import com.example.newscrawler.entity.TopicPost;
import com.example.newscrawler.entity.UserRole;
import com.example.newscrawler.repository.EditorUserRepository;
import com.example.newscrawler.repository.RegisteredUserRepository;
import com.example.newscrawler.repository.TopicPostRepository;
import com.example.newscrawler.service.AppUserResolver;
import com.example.newscrawler.service.TopicEditorService;
import com.example.newscrawler.service.TopicPostReactionService;
import com.example.newscrawler.service.TopicService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/topics")
public class TopicController {

    private final TopicService topicService;
    private final TopicEditorService topicEditorService;
    private final TopicPostReactionService topicPostReactionService;
    private final AppUserResolver appUserResolver;
    private final TopicPostRepository topicPostRepository;
    private final EditorUserRepository editorUserRepository;
    private final RegisteredUserRepository registeredUserRepository;

    public TopicController(TopicService topicService,
                           TopicEditorService topicEditorService,
                           TopicPostReactionService topicPostReactionService,
                           AppUserResolver appUserResolver,
                           TopicPostRepository topicPostRepository,
                           EditorUserRepository editorUserRepository,
                           RegisteredUserRepository registeredUserRepository) {
        this.topicService = topicService;
        this.topicEditorService = topicEditorService;
        this.topicPostReactionService = topicPostReactionService;
        this.appUserResolver = appUserResolver;
        this.topicPostRepository = topicPostRepository;
        this.editorUserRepository = editorUserRepository;
        this.registeredUserRepository = registeredUserRepository;
    }

    // ─── Get all topics (admin uses this; public/users see only ACTIVE via query param) ───

    @GetMapping
    public ResponseEntity<List<TopicResponse>> getAllTopics(
            @RequestParam(required = false, defaultValue = "false") String activeOnly) {
        if ("true".equalsIgnoreCase(activeOnly)) {
            return ResponseEntity.ok(topicService.getAllActiveTopics());
        }
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

    // ─── Admin: delete ALL topics (cleanup) ──────────────────────────────────
    //
    // One-time cleanup endpoint to wipe the trending-topics table.
    // Topics are normally auto-created/recreated from admin events, so this
    // is safe to call after deploying the topicId-link fix to remove
    // orphaned/duplicated topics that were left behind by the old
    // title-match logic.
    //
    // Pass ?confirm=true to actually perform the delete (safety guard).

    @DeleteMapping("/all")
    @PreAuthorize("hasRole('MANAGE_USERS') or hasRole('MANAGE_EVENTS')")
    public ResponseEntity<Map<String, Object>> deleteAllTopics(
            @RequestParam(required = false, defaultValue = "false") String confirm) {
        if (!"true".equalsIgnoreCase(confirm)) {
            return ResponseEntity.ok(Map.of(
                "status", "preview",
                "message", "This will delete ALL topics and their posts. Pass ?confirm=true to proceed.",
                "topicCount", topicService.getAllTopics().size()
            ));
        }
        int deleted = topicService.deleteAllTopics();
        return ResponseEntity.ok(Map.of(
            "status", "ok",
            "message", "All topics and their posts have been deleted. They will be re-created automatically the next time an admin creates/updates a PUBLIC or EDITOR_VISIBLE event.",
            "deletedCount", deleted
        ));
    }

    // ─── Get posts for a topic ───────────────────────────────────────────────

    @GetMapping("/{id}/posts")
    public ResponseEntity<List<TopicPostResponse>> getTopicPosts(
            @PathVariable Long id,
            @RequestParam(required = false) String userId,
            HttpServletRequest request) {
        AppUser appUser = null;
        try {
            appUser = appUserResolver.resolve(request, userId);
        } catch (ResponseStatusException ignored) {
            // Guests without a valid session still receive posts without userReaction.
        }
        return ResponseEntity.ok(topicService.getPostsByTopic(id, appUser));
    }

    @PutMapping("/{topicId}/posts/{postId}/react")
    public ResponseEntity<Map<String, Object>> reactToTopicPost(
            @PathVariable Long topicId,
            @PathVariable Long postId,
            @RequestParam ReactionType type,
            @RequestParam(required = false) String userId,
            HttpServletRequest request) {
        AppUser appUser = appUserResolver.resolve(request, userId);
        String status = topicPostReactionService.react(appUser, topicId, postId, type);

        TopicPost post = topicPostRepository.findById(postId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Topic post not found"));

        ReactionType userReaction = topicPostReactionService.getUserReaction(appUser.getId(), postId).orElse(null);

        Map<String, Object> body = new HashMap<>();
        body.put("status", status);
        body.put("likes", post.getLikes());
        body.put("dislikes", post.getDislikes());
        body.put("userReaction", userReaction);
        return ResponseEntity.ok(body);
    }

    // ─── Admin: delete a post from a topic ────────────────────────────────────

    @DeleteMapping("/{topicId}/posts/{postId}")
    @PreAuthorize("hasRole('DELETE_ANY_ARTICLE') or hasRole('MANAGE_EVENTS') or hasRole('MANAGE_USERS')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTopicPost(@PathVariable Long topicId, @PathVariable Long postId) {
        topicService.deleteTopicPost(topicId, postId);
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

    /**
     * Check if the current editor can request to post in a topic based on field matching.
     * Returns whether the editor is eligible, their current assignment status if any, and field info.
     */
    @GetMapping("/{topicId}/can-request")
    public ResponseEntity<Map<String, Object>> canRequestToPost(
            @PathVariable Long topicId,
            Authentication authentication) {
        String email = authentication.getName();
        EditorUser editor = editorUserRepository.findByEmail(email).orElse(null);
        if (editor == null) {
            return ResponseEntity.ok(Map.of(
                "eligible", false,
                "reason", "Only editors can request to post"
            ));
        }

        com.example.newscrawler.entity.Topic topic = topicService.getTopicEntityById(topicId);
        if (topic == null) {
            return ResponseEntity.ok(Map.of(
                "eligible", false,
                "reason", "Topic not found"
            ));
        }

        // Check field match
        boolean fieldsMatch = topicEditorService.fieldsMatch(editor, topic);

        // Check existing assignment
        String assignmentStatus = topicEditorService.getAssignmentStatus(topicId, editor.getId());

        Map<String, Object> response = new java.util.HashMap<>();
        response.put("eligible", fieldsMatch);
        response.put("assignmentStatus", assignmentStatus);
        response.put("editorFieldIds", editor.getFields().stream().map(com.example.newscrawler.entity.CategoryField::getId).collect(Collectors.toList()));
        response.put("topicFieldIds", topic.getFields().stream().map(com.example.newscrawler.entity.CategoryField::getId).collect(Collectors.toList()));
        if (!fieldsMatch) {
            response.put("reason", "Your fields don't match this topic's fields");
        }

        return ResponseEntity.ok(response);
    }
}
