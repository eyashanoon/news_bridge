package com.example.newscrawler.controller;

import com.example.newscrawler.dto.CommentResponse;
import com.example.newscrawler.dto.CreateCommentRequest;
import com.example.newscrawler.dto.CommentVoteRequest;
import com.example.newscrawler.entity.AppUser;
import com.example.newscrawler.service.AppUserService;
import com.example.newscrawler.service.CommentService;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/comments")
public class CommentController {
    private final CommentService commentService;
    private final AppUserService appUserService;

    public CommentController(CommentService commentService, AppUserService appUserService) {
        this.commentService = commentService;
        this.appUserService = appUserService;
    }

    /**
     * Get all comments for a post, with sorting and pagination
     * Query params:
     * - sortBy: "recency" (default) or "popularity"
     * - page: page number (default 0)
     * - size: page size (default 20)
     */
    @GetMapping("/post/{postId}")
    public Page<CommentResponse> getCommentsForPost(
            @PathVariable Long postId,
            @RequestParam(defaultValue = "recency") String sortBy,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) Long userId) {
        return commentService.getCommentsByPost(postId, sortBy, page, size, userId);
    }

    /**
     * Get replies for a specific comment
     */
    @GetMapping("/{commentId}/replies")
    public List<CommentResponse> getReplies(
            @PathVariable Long commentId,
            @RequestParam(required = false) Long userId) {
        return commentService.getRepliesByCommentId(commentId, userId);
    }

    /**
     * Create a new comment or reply
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CommentResponse createComment(
            @RequestBody CreateCommentRequest request,
            Authentication authentication) {
        Long userId = extractUserId(authentication);
        return commentService.createComment(request, userId);
    }

    /**
     * Vote on a comment
     * voteType: 1 for upvote, -1 for downvote, 0 to remove vote
     */
    @PostMapping("/{commentId}/vote")
    public CommentResponse voteOnComment(
            @PathVariable Long commentId,
            @RequestBody CommentVoteRequest request,
            Authentication authentication) {
        Long userId = extractUserId(authentication);
        return commentService.voteOnComment(commentId, userId, request.voteType());
    }

    /**
     * Delete a comment (only owner can delete)
     */
    @DeleteMapping("/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteComment(
            @PathVariable Long commentId,
            Authentication authentication) {
        Long userId = extractUserId(authentication);
        commentService.deleteComment(commentId, userId);
    }

    private Long extractUserId(Authentication authentication) {
        // JwtAuthenticationFilter sets the principal to the user's email,
        // or the userId as fallback (for primitive users).
        // We look up the user by their email (for registered/editor) or by ID (for primitive)
        String principal = authentication.getName();
        // Try to parse as a user ID first
        try {
            return Long.parseLong(principal);
        } catch (NumberFormatException e) {
            // Principal is an email - look up the registered user
            AppUser user = appUserService.findByEmail(principal);
            if (user != null) {
                return user.getId();
            }
            throw new RuntimeException("Authenticated user not found: " + principal);
        }
    }
}
