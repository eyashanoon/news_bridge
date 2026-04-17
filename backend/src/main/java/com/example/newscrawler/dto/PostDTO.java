package com.example.newscrawler.dto;

import com.example.newscrawler.entity.Post;
import com.example.newscrawler.entity.ReactionType;

public class PostDTO {

    private Long id;
    private String text;
    private String label;
    private String lang;

    private String title;
    private int numImages;
    private long likes;
    private long dislikes;
    private Long articleId;

    private ReactionType userReaction;

    public PostDTO(Post post, long likes, long dislikes, ReactionType userReaction) {
        this.id = post.getId();
        this.text = post.getText();
        this.label = post.getLabel();
        this.lang = post.getLang();
        this.title = post.getTitle();
        this.likes = likes;
        this.dislikes = dislikes;
        this.userReaction = userReaction;
        this.numImages = post.getNumImages();
        if (post.getArticle() != null) {
            this.articleId = post.getArticle().getId();
        }
    }

    public Long getId() { return id; }
    public String getText() { return text; }
    public String getLabel() { return label; }
    public String getLang() { return lang; }
    public String getTitle() { return title; }

    public long getLikes() { return likes; }
    public long getDislikes() { return dislikes; }

    public ReactionType getUserReaction() { return userReaction; }

    public int getNumImages() { return numImages; }
    public void setNumImages(int numImages) { this.numImages = numImages; }

    public Long getArticleId() { return articleId; }
    public void setArticleId(Long articleId) { this.articleId = articleId; }
}
