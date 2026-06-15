package com.example.newscrawler.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "editor_requests")
@com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class EditorRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "user_id", nullable = false)
    private RegisteredUser user;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "editor_request_fields",
        joinColumns = @JoinColumn(name = "editor_request_id"),
        inverseJoinColumns = @JoinColumn(name = "field_id")
    )
    private List<CategoryField> fields = new ArrayList<>();

    @Column(columnDefinition = "TEXT")
    private String experience;

    @Column
    private String phone;

    @Column
    private String status = "PENDING";

    @Column(name = "reference_docs", columnDefinition = "TEXT")
    private String references;

    @Column(columnDefinition = "LONGTEXT")
    private String profilePicture;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    
    public RegisteredUser getUser() { return user; }
    public void setUser(RegisteredUser user) { this.user = user; }
    
    public List<CategoryField> getFields() { return fields; }
    public void setFields(List<CategoryField> fields) { this.fields = fields; }
    
    public String getExperience() { return experience; }
    public void setExperience(String experience) { this.experience = experience; }
    
    public String getReferences() { return references; }
    public void setReferences(String references) { this.references = references; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getProfilePicture() { return profilePicture; }
    public void setProfilePicture(String profilePicture) { this.profilePicture = profilePicture; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}