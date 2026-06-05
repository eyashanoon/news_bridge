package com.example.newscrawler.entity;

import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "editor_users")
public class EditorUser extends RegisteredUser {

    @Column(columnDefinition = "TEXT")
    private String experience;

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "editor_user_fields",
        joinColumns = @JoinColumn(name = "editor_user_id"),
        inverseJoinColumns = @JoinColumn(name = "field_id")
    )
    private List<CategoryField> fields = new ArrayList<>();

    @Column(name = "reference_docs", columnDefinition = "TEXT")
    private String references;

    @Column
    private String phone;

    public String getExperience() { return experience; }
    public void setExperience(String experience) { this.experience = experience; }

    public List<CategoryField> getFields() { return fields; }
    public void setFields(List<CategoryField> fields) { this.fields = fields; }

    public String getReferences() { return references; }
    public void setReferences(String references) { this.references = references; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
}
