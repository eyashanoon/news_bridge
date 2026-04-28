package com.example.newscrawler.dto;

import java.time.LocalDateTime;

public class PostByTagResponse {
    private Long postId;
    private String tag;
    private LocalDateTime timestamp;

    public PostByTagResponse() {}

    public PostByTagResponse(Long postId, String tag, LocalDateTime timestamp) {
        this.postId = postId;
        this.tag = tag;
        this.timestamp = timestamp;
    }

    // Getters and Setters
    public Long getPostId() {
        return postId;
    }

    public void setPostId(Long postId) {
        this.postId = postId;
    }

    public String getTag() {
        return tag;
    }

    public void setTag(String tag) {
        this.tag = tag;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }
}
