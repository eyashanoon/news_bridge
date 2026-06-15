package com.example.newscrawler.dto;

import com.example.newscrawler.entity.ReactionType;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

public class TopicPostResponse {
    public Long id;
    public Long topicId;
    public String title;
    public String text;
    public String label;
    public String lang;
    public List<String> tags;
    public int likes;
    public int dislikes;
    public ReactionType userReaction;
    public String author;
    public Long authorId;
    public String authorEmail;
    public String authorProfilePicture;
    public String mediaUrl;
    public String mediaType;
    /** List of {type, url} maps for multiple media support */
    public List<Map<String, String>> mediaItems;
    public LocalDateTime createdAt;
}
