package com.example.newscrawler.dto;

import java.time.Instant;
import java.util.List;

public record CommentResponse(
    Long id,
    Long postId,
    Long userId,
    String userIdentifier,
    String content,
    Long parentCommentId,
    String attachmentUrl,
    String attachmentType,
    Integer voteScore,
    Integer userVote,
    Instant createdAt,
    List<CommentResponse> replies,
    String profilePicture,
    String profileUsername
) {}