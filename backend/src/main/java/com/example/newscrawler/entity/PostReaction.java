package com.example.newscrawler.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "PostReactions",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "post_id"}))
public class PostReaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private AppUser appUser;

    @ManyToOne(optional = false)
    @JoinColumn(name = "post_id")
    private Post post;

    @Enumerated(EnumType.STRING)
    private ReactionType reactionType;

    public PostReaction() {}

    public PostReaction(AppUser appUser, Post post, ReactionType reactionType) {
        this.appUser = appUser;
        this.post = post;
        this.reactionType = reactionType;
    }

    public Long getId() { return id; }

    public AppUser getAppUser() { return appUser; }
    public AppUser getUser() { return appUser; } /* for compatibility */
    public void setAppUser(AppUser appUser) { this.appUser = appUser; }

    public Post getPost() { return post; }

    public ReactionType getReactionType() { return reactionType; }
    public void setReactionType(ReactionType reactionType) { this.reactionType = reactionType; }
}
