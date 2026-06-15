package com.example.newscrawler.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "telegram_crawl_logs", indexes = {
        @Index(name = "idx_tg_crawl_channel_time", columnList = "channel_id, started_at")
})
public class TelegramCrawlLog {

    public enum CrawlStatus {
        SUCCESS, FAILED, PARTIAL
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "channel_id", nullable = false)
    private TelegramChannel channel;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CrawlStatus status = CrawlStatus.SUCCESS;

    @Column(name = "posts_created", nullable = false)
    private int postsCreated = 0;

    @Column(name = "posts_skipped", nullable = false)
    private int postsSkipped = 0;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(name = "worker_id")
    private Integer workerId;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public TelegramChannel getChannel() { return channel; }
    public void setChannel(TelegramChannel channel) { this.channel = channel; }

    public Instant getStartedAt() { return startedAt; }
    public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }

    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }

    public CrawlStatus getStatus() { return status; }
    public void setStatus(CrawlStatus status) { this.status = status; }

    public int getPostsCreated() { return postsCreated; }
    public void setPostsCreated(int postsCreated) { this.postsCreated = postsCreated; }

    public int getPostsSkipped() { return postsSkipped; }
    public void setPostsSkipped(int postsSkipped) { this.postsSkipped = postsSkipped; }

    public String getErrorMessage() { return errorMessage; }
    public void setErrorMessage(String errorMessage) { this.errorMessage = errorMessage; }

    public Long getDurationMs() { return durationMs; }
    public void setDurationMs(Long durationMs) { this.durationMs = durationMs; }

    public Integer getWorkerId() { return workerId; }
    public void setWorkerId(Integer workerId) { this.workerId = workerId; }

    public Instant getCreatedAt() { return createdAt; }
}
