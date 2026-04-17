package com.example.newscrawler.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "telegram_channels")
@com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class TelegramChannel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String channelUsername;

    @Column
    private String displayName;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column
    private String avatarUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RecordStatus status = RecordStatus.ACTIVE;

    @Column(nullable = false)
    private int totalPostsCollected = 0;

    @Column
    private Instant lastCrawledAt;

    @Column(name = "added_by_email")
    private String addedByEmail;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;

    // ---------- getters / setters ----------

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getChannelUsername() { return channelUsername; }
    public void setChannelUsername(String channelUsername) { this.channelUsername = channelUsername; }

    public String getDisplayName() { return displayName; }
    public void setDisplayName(String displayName) { this.displayName = displayName; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }

    public RecordStatus getStatus() { return status; }
    public void setStatus(RecordStatus status) { this.status = status; }

    public int getTotalPostsCollected() { return totalPostsCollected; }
    public void setTotalPostsCollected(int totalPostsCollected) { this.totalPostsCollected = totalPostsCollected; }

    public Instant getLastCrawledAt() { return lastCrawledAt; }
    public void setLastCrawledAt(Instant lastCrawledAt) { this.lastCrawledAt = lastCrawledAt; }

    public String getAddedByEmail() { return addedByEmail; }
    public void setAddedByEmail(String addedByEmail) { this.addedByEmail = addedByEmail; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
