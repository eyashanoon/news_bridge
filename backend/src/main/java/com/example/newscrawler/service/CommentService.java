package com.example.newscrawler.service;

import com.example.newscrawler.dto.CommentResponse;
import com.example.newscrawler.dto.CreateCommentRequest;
import com.example.newscrawler.entity.*;
import com.example.newscrawler.repository.CommentRepository;
import com.example.newscrawler.repository.CommentVoteRepository;
import com.example.newscrawler.repository.PostRepository;
import com.example.newscrawler.repository.AppUserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class CommentService {
    private final CommentRepository commentRepository;
    private final CommentVoteRepository commentVoteRepository;
    private final PostRepository postRepository;
    private final AppUserRepository userRepository;

    public CommentService(CommentRepository commentRepository, 
                          CommentVoteRepository commentVoteRepository,
                          PostRepository postRepository,
                          AppUserRepository userRepository) {
        this.commentRepository = commentRepository;
        this.commentVoteRepository = commentVoteRepository;
        this.postRepository = postRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public CommentResponse createComment(CreateCommentRequest request, Long userId) {
        Post post = postRepository.findById(request.postId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found"));
        
        AppUser user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        Comment comment = new Comment();
        comment.setPost(post);
        comment.setUser(user);
        comment.setContent(request.content());
        comment.setAttachmentUrl(request.attachmentUrl());
        comment.setAttachmentType(request.attachmentType());

        // Set parent comment if it's a reply
        if (request.parentCommentId() != null) {
            Comment parentComment = commentRepository.findById(request.parentCommentId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Parent comment not found"));
            comment.setParentComment(parentComment);
        }

        Comment saved = commentRepository.save(comment);
        return toResponse(saved, userId);
    }

    @Transactional(readOnly = true)
    public Page<CommentResponse> getCommentsByPost(Long postId, String sortBy, int page, int size, Long userId) {
        Pageable pageable = PageRequest.of(page, size);
        
        Page<Comment> comments;
        if ("popularity".equals(sortBy)) {
            comments = commentRepository.findRootCommentsByPostIdOrderByPopularity(postId, pageable);
        } else {
            // Default to "recency" (newest first)
            comments = commentRepository.findRootCommentsByPostId(postId, pageable);
        }

        return comments.map(c -> toResponse(c, userId));
    }

    @Transactional(readOnly = true)
    public List<CommentResponse> getRepliesByCommentId(Long commentId, Long userId) {
        List<Comment> replies = commentRepository.findRepliesByParentCommentId(commentId);
        return replies.stream()
                .map(c -> toResponse(c, userId))
                .collect(Collectors.toList());
    }

    @Transactional
    public CommentResponse voteOnComment(Long commentId, Long userId, int voteType) {
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Comment not found"));

        AppUser user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        // Check if user already voted
        var existingVote = commentVoteRepository.findByCommentIdAndUserId(commentId, userId);

        if (existingVote.isPresent()) {
            CommentVote vote = existingVote.get();
            if (voteType == 0) {
                // Remove vote
                int oldVoteType = vote.getVoteType();
                commentVoteRepository.delete(vote);
                comment.setVoteScore(comment.getVoteScore() - oldVoteType);
            } else if (vote.getVoteType() != voteType) {
                // Change vote
                int oldVoteType = vote.getVoteType();
                vote.setVoteType(voteType);
                commentVoteRepository.save(vote);
                comment.setVoteScore(comment.getVoteScore() - oldVoteType + voteType);
            }
        } else if (voteType != 0) {
            // Add new vote
            CommentVote newVote = new CommentVote(comment, user, voteType);
            commentVoteRepository.save(newVote);
            comment.setVoteScore(comment.getVoteScore() + voteType);
        }

        Comment updated = commentRepository.save(comment);
        return toResponse(updated, userId);
    }

    @Transactional
    public void deleteComment(Long commentId, Long userId) {
        Comment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Comment not found"));

        // Check if user is the owner
        if (!comment.getUser().getId().equals(userId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only delete your own comments");
        }

        // Delete all votes for this comment
        List<CommentVote> votes = commentVoteRepository.findByCommentId(commentId);
        commentVoteRepository.deleteAll(votes);

        commentRepository.delete(comment);
    }

    private CommentResponse toResponse(Comment comment, Long currentUserId) {
        // Get user identifier
        String userIdentifier = getUserIdentifier(comment.getUser());

        // Get user's vote on this comment
        Integer userVote = null;
        if (currentUserId != null) {
            userVote = commentVoteRepository.findByCommentIdAndUserId(comment.getId(), currentUserId)
                    .map(CommentVote::getVoteType)
                    .orElse(0);
        }

        // Get replies (don't include them for top-level comments to avoid recursion)
        List<CommentResponse> replies = comment.getParentComment() == null ? 
                List.of() : List.of();

        return new CommentResponse(
            comment.getId(),
            comment.getPost().getId(),
            comment.getUser().getId(),
            userIdentifier,
            comment.getContent(),
            comment.getParentComment() != null ? comment.getParentComment().getId() : null,
            comment.getAttachmentUrl(),
            comment.getAttachmentType(),
            comment.getVoteScore(),
            userVote,
            comment.getCreatedAt(),
            replies
        );
    }

    private String getUserIdentifier(AppUser user) {
        if (user instanceof RegisteredUser) {
            return ((RegisteredUser) user).getUsername();
        }
        return "User " + user.getId();
    }
}
