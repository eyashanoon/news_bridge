package com.example.newscrawler.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "user_channel_preferences", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "channel_id"})
})
public class UserChannelPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private AppUser user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "channel_id", nullable = false)
    private TelegramChannel channel;

    @Column(nullable = false)
    private double weight = 0.0;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;

    public UserChannelPreference() {}

    public UserChannelPreference(AppUser user, TelegramChannel channel, double weight) {
        this.user = user;
        this.channel = channel;
        this.weight = weight;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public AppUser getUser() { return user; }
    public void setUser(AppUser user) { this.user = user; }

    public TelegramChannel getChannel() { return channel; }
    public void setChannel(TelegramChannel channel) { this.channel = channel; }

    public double getWeight() { return weight; }
    public void setWeight(double weight) { this.weight = weight; }

    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
