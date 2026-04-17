package com.example.newscrawler.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "publish_permission_requests",
       uniqueConstraints = @UniqueConstraint(columnNames = {"event_id", "editor_id"}))
@com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class PublishPermissionRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "event_id", nullable = false)
    private NewsEvent event;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "editor_id", nullable = false)
    private EditorUser editor;

    /**
     * PENDING / APPROVED / REJECTED
     */
    @Column(nullable = false)
    private String status = "PENDING";

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant requestedAt;

    @Column
    private Instant reviewedAt;

    @Column(name = "reviewed_by_email")
    private String reviewedByEmail;

    // ---------- getters/setters ----------

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public NewsEvent getEvent() { return event; }
    public void setEvent(NewsEvent event) { this.event = event; }

    public EditorUser getEditor() { return editor; }
    public void setEditor(EditorUser editor) { this.editor = editor; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Instant getRequestedAt() { return requestedAt; }

    public Instant getReviewedAt() { return reviewedAt; }
    public void setReviewedAt(Instant reviewedAt) { this.reviewedAt = reviewedAt; }

    public String getReviewedByEmail() { return reviewedByEmail; }
    public void setReviewedByEmail(String reviewedByEmail) { this.reviewedByEmail = reviewedByEmail; }
}
