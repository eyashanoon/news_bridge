package com.example.newscrawler.entity;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;

@Entity
@Table(name = "endpoints")
public class Endpoint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 2048)
    private String url;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "root_id", nullable = false)
    private Root root;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RecordStatus status = RecordStatus.ACTIVE;

    @OneToMany(mappedBy = "endpoint")
    private List<Article> articles = new ArrayList<>();

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public Long getId() {
        return id;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public Root getRoot() {
        return root;
    }

    public void setRoot(Root root) {
        this.root = root;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public List<Article> getArticles() {
        return articles;
    }

    public RecordStatus getStatus() {
        return status;
    }

    public void setStatus(RecordStatus status) {
        this.status = status;
    }
}
