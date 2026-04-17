package com.example.newscrawler.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

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

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "field_id")
    private CategoryField field;

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

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    
    public RegisteredUser getUser() { return user; }
    public void setUser(RegisteredUser user) { this.user = user; }
    
    public CategoryField getField() { return field; }
    public void setField(CategoryField field) { this.field = field; }
    
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
}

