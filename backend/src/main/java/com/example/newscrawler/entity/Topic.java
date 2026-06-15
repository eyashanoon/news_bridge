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

    // ─── Trending Statistics (computed every minute by scheduler) ──────────

    /** Total likes across all topic posts */
    private int totalLikes;

    /** Total dislikes across all topic posts */
    private int totalDislikes;

    /** Total comments count across all regular posts linked to this topic's articles */
    private int totalComments;

    /** Composite activity score based on recency and engagement */
    private double activityScore;

    /** Timestamp of the most recent activity (latest post) on this topic */
    private LocalDateTime lastActivityAt;

    /** Timestamp when statistics were last recalculated */
    private LocalDateTime statsUpdatedAt;

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

    public int getTotalLikes() { return totalLikes; }
    public void setTotalLikes(int totalLikes) { this.totalLikes = totalLikes; }

    public int getTotalDislikes() { return totalDislikes; }
    public void setTotalDislikes(int totalDislikes) { this.totalDislikes = totalDislikes; }

    public int getTotalComments() { return totalComments; }
    public void setTotalComments(int totalComments) { this.totalComments = totalComments; }

    public double getActivityScore() { return activityScore; }
    public void setActivityScore(double activityScore) { this.activityScore = activityScore; }

    public LocalDateTime getLastActivityAt() { return lastActivityAt; }
    public void setLastActivityAt(LocalDateTime lastActivityAt) { this.lastActivityAt = lastActivityAt; }

    public LocalDateTime getStatsUpdatedAt() { return statsUpdatedAt; }
    public void setStatsUpdatedAt(LocalDateTime statsUpdatedAt) { this.statsUpdatedAt = statsUpdatedAt; }
}
