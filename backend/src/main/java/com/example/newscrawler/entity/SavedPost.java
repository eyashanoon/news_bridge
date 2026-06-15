package com.example.newscrawler.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "saved_posts",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "post_id"}))
public class SavedPost {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private AppUser appUser;

    @ManyToOne(optional = false)
    @JoinColumn(name = "post_id")
    private Post post;

    @Column(nullable = false)
    private long savedAt;

    @Column(columnDefinition = "TEXT")
    private String note;

    /** JSON array of SavedCollection.externalId values */
    @Column(columnDefinition = "TEXT")
    private String collectionIdsJson;

    public SavedPost() {}

    public SavedPost(AppUser appUser, Post post, long savedAt) {
        this.appUser = appUser;
        this.post = post;
        this.savedAt = savedAt;
        this.note = "";
        this.collectionIdsJson = "[]";
    }

    public Long getId() { return id; }

    public AppUser getAppUser() { return appUser; }
    public void setAppUser(AppUser appUser) { this.appUser = appUser; }

    public Post getPost() { return post; }
    public void setPost(Post post) { this.post = post; }

    public long getSavedAt() { return savedAt; }
    public void setSavedAt(long savedAt) { this.savedAt = savedAt; }

    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }

    public String getCollectionIdsJson() { return collectionIdsJson; }
    public void setCollectionIdsJson(String collectionIdsJson) { this.collectionIdsJson = collectionIdsJson; }
}
