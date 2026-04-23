package com.example.newscrawler.controller;

import com.example.newscrawler.dto.CommentResponse;
import com.example.newscrawler.dto.CreateCommentRequest;
import com.example.newscrawler.dto.CommentVoteRequest;
import com.example.newscrawler.service.CommentService;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/comments")
public class CommentController {
    private final CommentService commentService;

    public CommentController(CommentService commentService) {
        this.commentService = commentService;
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
            @RequestParam Long userId) {
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
            @RequestParam Long userId) {
        return commentService.voteOnComment(commentId, userId, request.voteType());
    }

    /**
     * Delete a comment (only owner can delete)
     */
    @DeleteMapping("/{commentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteComment(
            @PathVariable Long commentId,
            @RequestParam Long userId) {
        commentService.deleteComment(commentId, userId);
    }
}
