package com.example.newscrawler.dto;

import com.example.newscrawler.entity.ReactionType;
import java.time.Instant;
import java.util.List;

public class FeedPostDTO {

    public Long id;
    public String text;
    public String label;
    public String lang;
    public String title;
    public long likes;
    public long dislikes;
    public int numImages;
    public ReactionType userReaction;
    public Long articleId;
    public String articleUrl;
    public Instant articleCreatedAt;
    public List<String> tags;

    public FeedPostDTO(Long id, String text, String label, String lang, String title,
                       long likes, long dislikes,
                       ReactionType userReaction,
                       List<String> tags, int numImages, Long articleId,
                       String articleUrl, Instant articleCreatedAt) {

        this.id = id;
        this.text = text;
        this.label = label;
        this.lang = lang;
        this.title = title;
        this.likes = likes;
        this.dislikes = dislikes;
        this.userReaction = userReaction;
        this.tags = tags;
        this.numImages = numImages;
        this.articleId = articleId;
        this.articleUrl = articleUrl;
        this.articleCreatedAt = articleCreatedAt;
    }
}
