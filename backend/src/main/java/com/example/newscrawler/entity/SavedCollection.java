package com.example.newscrawler.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "saved_collections",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "external_id"}))
public class SavedCollection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private AppUser appUser;

    @Column(name = "external_id", nullable = false)
    private String externalId;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String icon;

    @Column(nullable = false)
    private long createdAt;

    public SavedCollection() {}

    public SavedCollection(AppUser appUser, String externalId, String name, String icon, long createdAt) {
        this.appUser = appUser;
        this.externalId = externalId;
        this.name = name;
        this.icon = icon != null && !icon.isBlank() ? icon : "📁";
        this.createdAt = createdAt;
    }

    public Long getId() { return id; }

    public AppUser getAppUser() { return appUser; }
    public void setAppUser(AppUser appUser) { this.appUser = appUser; }

    public String getExternalId() { return externalId; }
    public void setExternalId(String externalId) { this.externalId = externalId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getIcon() { return icon; }
    public void setIcon(String icon) { this.icon = icon; }

    public long getCreatedAt() { return createdAt; }
    public void setCreatedAt(long createdAt) { this.createdAt = createdAt; }
}
