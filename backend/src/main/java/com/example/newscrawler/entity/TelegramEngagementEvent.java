package com.example.newscrawler.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "telegram_engagement_events", indexes = {
        @Index(name = "idx_tg_eng_channel_time", columnList = "channel_id, created_at"),
        @Index(name = "idx_tg_eng_post", columnList = "post_id")
})
public class TelegramEngagementEvent {

    public enum EventType {
        VIEW, READ_TIME
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "channel_id", nullable = false)
    private Long channelId;

    @Column(name = "post_id")
    private Long postId;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false)
    private EventType eventType = EventType.VIEW;

    @Column(nullable = false)
    private double value = 1.0;

    @Column(name = "feed_score")
    private Double feedScore;

    /** Resolved tag vector at event time — keeps analytics stable even if post/channel tags change later. */
    @Column(name = "tag_snapshot", columnDefinition = "TEXT")
    private String tagSnapshot;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public Long getChannelId() { return channelId; }
    public void setChannelId(Long channelId) { this.channelId = channelId; }

    public Long getPostId() { return postId; }
    public void setPostId(Long postId) { this.postId = postId; }

    public EventType getEventType() { return eventType; }
    public void setEventType(EventType eventType) { this.eventType = eventType; }

    public double getValue() { return value; }
    public void setValue(double value) { this.value = value; }

    public Double getFeedScore() { return feedScore; }
    public void setFeedScore(Double feedScore) { this.feedScore = feedScore; }

    public String getTagSnapshot() { return tagSnapshot; }
    public void setTagSnapshot(String tagSnapshot) { this.tagSnapshot = tagSnapshot; }

    public Instant getCreatedAt() { return createdAt; }
}
