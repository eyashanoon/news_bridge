package com.example.newscrawler.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * Learned Telegram content interests (tag vector), separate from article UserPreference
 * and from per-channel follow weights.
 */
@Entity
@Table(name = "user_telegram_content_preferences", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id"})
})
public class UserTelegramContentPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private AppUser user;

    /** JSON map tag→weight — fused from channel content profiles the user engaged with */
    @Column(name = "content_tag_vector", columnDefinition = "TEXT")
    private String contentTagVector = "{}";

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;

    public UserTelegramContentPreference() {}

    public UserTelegramContentPreference(AppUser user) {
        this.user = user;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public AppUser getUser() { return user; }
    public void setUser(AppUser user) { this.user = user; }

    public String getContentTagVector() { return contentTagVector; }
    public void setContentTagVector(String contentTagVector) { this.contentTagVector = contentTagVector; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
