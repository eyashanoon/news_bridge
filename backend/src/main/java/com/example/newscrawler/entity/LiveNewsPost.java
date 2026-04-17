package com.example.newscrawler.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "live_news_posts")
@com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class LiveNewsPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "event_id", nullable = false)
    private NewsEvent event;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "author_id", nullable = false)
    private EditorUser author;

    @Column(nullable = false)
    private String headline;

    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String content;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant publishedAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;

    // ---------- getters/setters ----------

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public NewsEvent getEvent() { return event; }
    public void setEvent(NewsEvent event) { this.event = event; }

    public EditorUser getAuthor() { return author; }
    public void setAuthor(EditorUser author) { this.author = author; }

    public String getHeadline() { return headline; }
    public void setHeadline(String headline) { this.headline = headline; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public Instant getPublishedAt() { return publishedAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
