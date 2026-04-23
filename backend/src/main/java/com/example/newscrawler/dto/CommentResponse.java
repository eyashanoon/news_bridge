package com.example.newscrawler.dto;

import java.time.Instant;
import java.util.List;

public record CommentResponse(
    Long id,
    Long postId,
    Long userId,
    String userIdentifier, // Can be username or ID depending on user type
    String content,
    Long parentCommentId,
    String attachmentUrl,
    String attachmentType,
    Integer voteScore,
    Integer userVote, // -1 for downvote, 0 for no vote, 1 for upvote
    Instant createdAt,
    List<CommentResponse> replies
) {}
