package com.example.newscrawler.repository;

import com.example.newscrawler.entity.Comment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CommentRepository extends JpaRepository<Comment, Long> {

    // Find all comments for a post, sorted by creation date (most recent first)
    @Query("SELECT c FROM Comment c WHERE c.post.id = :postId AND c.parentComment IS NULL ORDER BY c.createdAt DESC")
    Page<Comment> findRootCommentsByPostId(@Param("postId") Long postId, Pageable pageable);

    // Find all comments for a post (including nested replies)
    @Query("SELECT c FROM Comment c WHERE c.post.id = :postId ORDER BY c.createdAt DESC")
    Page<Comment> findAllCommentsByPostId(@Param("postId") Long postId, Pageable pageable);

    // Find replies to a specific comment
    @Query("SELECT c FROM Comment c WHERE c.parentComment.id = :parentCommentId ORDER BY c.createdAt DESC")
    List<Comment> findRepliesByParentCommentId(@Param("parentCommentId") Long parentCommentId);

    // Find comments sorted by vote score (most popular)
    @Query("SELECT c FROM Comment c WHERE c.post.id = :postId AND c.parentComment IS NULL ORDER BY c.voteScore DESC, c.createdAt DESC")
    Page<Comment> findRootCommentsByPostIdOrderByPopularity(@Param("postId") Long postId, Pageable pageable);

    // Find comments by a specific user
    List<Comment> findByUserId(Long userId);
}
