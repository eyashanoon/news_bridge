package com.example.newscrawler.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "topics")
public class Topic {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    private String imageUrl;

    private String author;

    @Column(columnDefinition = "TEXT")
    private String tags; // comma-separated tags

    private int growth;

    private int postCount;

    private int contributorCount;

    /**
     * DRAFT     — only visible to admin
     * ACTIVE    — visible to all users (trending)
     * INACTIVE  — hidden
     */
    @Column(nullable = false)
    private String status = "DRAFT";

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "topic_fields",
        joinColumns = @JoinColumn(name = "topic_id"),
        inverseJoinColumns = @JoinColumn(name = "field_id")
    )
    private List<CategoryField> fields = new ArrayList<>();

    @Column(name = "created_by_email")
    private String createdByEmail;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    public void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }

    public String getTags() { return tags; }
    public void setTags(String tags) { this.tags = tags; }

    public int getGrowth() { return growth; }
    public void setGrowth(int growth) { this.growth = growth; }

    public int getPostCount() { return postCount; }
    public void setPostCount(int postCount) { this.postCount = postCount; }

    public int getContributorCount() { return contributorCount; }
    public void setContributorCount(int contributorCount) { this.contributorCount = contributorCount; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public List<CategoryField> getFields() { return fields; }
    public void setFields(List<CategoryField> fields) { this.fields = fields; }

    public String getCreatedByEmail() { return createdByEmail; }
    public void setCreatedByEmail(String createdByEmail) { this.createdByEmail = createdByEmail; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}