package com.example.newscrawler.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "telegram_posts", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"channel_id", "telegram_message_id"})
})
@com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class TelegramPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "channel_id", nullable = false)
    private TelegramChannel channel;

    @Column(nullable = false)
    private Long telegramMessageId;

    @Column(columnDefinition = "LONGTEXT")
    private String content;

    @Column
    private String mediaUrl;

    @Column
    private String mediaType;

    @Column
    private Instant messageDate;

    @Column
    private int viewCount = 0;

    @Column(nullable = false)
    private boolean edited = false;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant collectedAt;

    // ---------- getters / setters ----------

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public TelegramChannel getChannel() { return channel; }
    public void setChannel(TelegramChannel channel) { this.channel = channel; }

    public Long getTelegramMessageId() { return telegramMessageId; }
    public void setTelegramMessageId(Long telegramMessageId) { this.telegramMessageId = telegramMessageId; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getMediaUrl() { return mediaUrl; }
    public void setMediaUrl(String mediaUrl) { this.mediaUrl = mediaUrl; }

    public String getMediaType() { return mediaType; }
    public void setMediaType(String mediaType) { this.mediaType = mediaType; }

    public Instant getMessageDate() { return messageDate; }
    public void setMessageDate(Instant messageDate) { this.messageDate = messageDate; }

    public int getViewCount() { return viewCount; }
    public void setViewCount(int viewCount) { this.viewCount = viewCount; }

    public boolean isEdited() { return edited; }
    public void setEdited(boolean edited) { this.edited = edited; }

    public Instant getCollectedAt() { return collectedAt; }
}
