package com.example.newscrawler.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "topic_post_reactions",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "topic_post_id"}))
public class TopicPostReaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private AppUser appUser;

    @ManyToOne(optional = false)
    @JoinColumn(name = "topic_post_id")
    private TopicPost topicPost;

    @Enumerated(EnumType.STRING)
    private ReactionType reactionType;

    public TopicPostReaction() {}

    public TopicPostReaction(AppUser appUser, TopicPost topicPost, ReactionType reactionType) {
        this.appUser = appUser;
        this.topicPost = topicPost;
        this.reactionType = reactionType;
    }

    public Long getId() { return id; }

    public AppUser getAppUser() { return appUser; }

    public TopicPost getTopicPost() { return topicPost; }

    public ReactionType getReactionType() { return reactionType; }

    public void setReactionType(ReactionType reactionType) { this.reactionType = reactionType; }
}
