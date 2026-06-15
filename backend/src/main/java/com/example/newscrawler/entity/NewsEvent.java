package com.example.newscrawler.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "news_events")
@com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class NewsEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "field_id", nullable = false)
    private CategoryField field;

    /**
     * Comma-separated list of all field IDs assigned to this event.
     * Used when creating the corresponding topic to preserve multiple fields.
     */
    @Column(name = "field_ids", columnDefinition = "TEXT")
    private String fieldIds;

    /**
     * Foreign key to the trending-topics entry that was auto-created
     * from this event. Used to reliably clean up the associated topic
     * (and its posts) when the event is deleted, without relying on a
     * fragile title match.
     */
    @Column(name = "topic_id")
    private Long topicId;

    /**
     * DRAFT         — admin-only visible
     * EDITOR_VISIBLE — visible to editors of this field (can request publish rights)
     * PUBLIC        — visible to all users (readers can view live news)
     */
    @Column(nullable = false)
    private String status = "DRAFT";

    @Column(name = "created_by_email")
    private String createdByEmail;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;

    // ---------- getters/setters ----------

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public CategoryField getField() { return field; }
    public void setField(CategoryField field) { this.field = field; }

    public String getFieldIds() { return fieldIds; }
    public void setFieldIds(String fieldIds) { this.fieldIds = fieldIds; }

    public Long getTopicId() { return topicId; }
    public void setTopicId(Long topicId) { this.topicId = topicId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getCreatedByEmail() { return createdByEmail; }
    public void setCreatedByEmail(String createdByEmail) { this.createdByEmail = createdByEmail; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}