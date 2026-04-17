package com.example.newscrawler.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "editor_users")
public class EditorUser extends RegisteredUser {

    @Column(columnDefinition = "TEXT")
    private String experience;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "field_id")
    private CategoryField field;

    @Column(name = "reference_docs", columnDefinition = "TEXT")
    private String references;

    @Column
    private String phone;

    @Column(columnDefinition = "LONGTEXT")
    private String profilePicture;

    public String getExperience() { return experience; }
    public void setExperience(String experience) { this.experience = experience; }

    public CategoryField getField() { return field; }
    public void setField(CategoryField field) { this.field = field; }

    public String getReferences() { return references; }
    public void setReferences(String references) { this.references = references; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getProfilePicture() { return profilePicture; }
    public void setProfilePicture(String profilePicture) { this.profilePicture = profilePicture; }
}
