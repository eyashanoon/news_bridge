package com.example.newscrawler.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "Posts")
public class Post {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(columnDefinition = "LONGTEXT")
    private String text;

    private String label;
    private String lang;

    private String title;

    @Column(nullable = false)
    private boolean tagsExtracted = false;

    private int numImages;
    @ManyToOne
    private Article article;
    private LocalDateTime createdAt;



    @PrePersist
    public void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public String getLang() { return lang; }
    public void setLang(String lang) { this.lang = lang; }

    public boolean isTagsExtracted() { return tagsExtracted; }
    public void setTagsExtracted(boolean tagsExtracted) { this.tagsExtracted = tagsExtracted; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public String getTitle() {
        return title;
    }

    public int getNumImages() {
        return numImages;
    }

    public void setTitle(String title) {
        this.title = title;
    }

        public Article getArticle() { return article; }
    public void setArticle(Article article) { this.article = article; }
    public void setNumImages(int numImages) {
        this.numImages = numImages;
    }
}





