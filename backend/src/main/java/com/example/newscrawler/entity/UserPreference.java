package com.example.newscrawler.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "UserPreferences",
        uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "tag"}))
public class UserPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "user_id")
    private AppUser appUser;

    @Column(nullable = false)
    private String tag;

    private double weight;

    public UserPreference() {}

    public UserPreference(AppUser appUser, String tag, double weight) {
        this.appUser = appUser;
        this.tag = tag;
        this.weight = weight;
    }

    public Long getId() { return id; }

    public AppUser getAppUser() { return appUser; }
    public AppUser getUser() { return appUser; } /* compatibility */
    public void setAppUser(AppUser appUser) { this.appUser = appUser; }

    public String getTag() { return tag; }

    public double getWeight() { return weight; }
    public void setWeight(double weight) { this.weight = weight; }
}
