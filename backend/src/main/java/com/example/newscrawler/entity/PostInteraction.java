package com.example.newscrawler.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "PostInteractions",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "post_id"}))
public class PostInteraction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private AppUser appUser;

    @ManyToOne(optional = false)
    @JoinColumn(name = "post_id")
    private Post post;

    private int views;
    private int clicks;
    private double totalTimeSpent;
    private LocalDateTime lastViewedAt;

    public PostInteraction() {}

    public PostInteraction(AppUser appUser, Post post) {
        this.appUser = appUser;
        this.post = post;
    }

    public Long getId() { return id; }

    public AppUser getAppUser() { return appUser; }
    public AppUser getUser() { return appUser; }
    public void setAppUser(AppUser appUser) { this.appUser = appUser; }

    public Post getPost() { return post; }

    public int getViews() { return views; }
    public void setViews(int views) { this.views = views; }

    public int getClicks() { return clicks; }
    public void setClicks(int clicks) { this.clicks = clicks; }

    public double getTotalTimeSpent() { return totalTimeSpent; }
    public void setTotalTimeSpent(double totalTimeSpent) { this.totalTimeSpent = totalTimeSpent; }

    public LocalDateTime getLastViewedAt() { return lastViewedAt; }
    public void setLastViewedAt(LocalDateTime lastViewedAt) { this.lastViewedAt = lastViewedAt; }
}
