package com.example.newscrawler.dto;

public record CreateCommentRequest(
    Long postId,
    String content,
    Long parentCommentId, // null if it's a top-level comment
    String attachmentUrl,
    String attachmentType // "image", "video", "gif"
) {}
