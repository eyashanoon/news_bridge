package com.example.newscrawler.repository;

import com.example.newscrawler.entity.CommentVote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface CommentVoteRepository extends JpaRepository<CommentVote, Long> {

    // Find a vote by comment and user
    Optional<CommentVote> findByCommentIdAndUserId(Long commentId, Long userId);

    // Find all votes for a comment
    @Query("SELECT cv FROM CommentVote cv WHERE cv.comment.id = :commentId")
    java.util.List<CommentVote> findByCommentId(@Param("commentId") Long commentId);
}
