package com.example.newscrawler.entity;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OneToOne;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;

@Entity
@Table(name = "articles")
public class Article {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 2048)
    private String url;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String text;

    @OneToOne(mappedBy = "article", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private ArticleTitle articleTitle;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "endpoint_id", nullable = false)
    private Endpoint endpoint;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "cache_endpoint_id", nullable = false, unique = true)
    private CacheEndpoint cacheEndpoint;

    @OneToMany(mappedBy = "article", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<ArticleBlock> blocks = new ArrayList<>();

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

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public ArticleTitle getArticleTitle() {
        return articleTitle;
    }

    public void setArticleTitle(ArticleTitle articleTitle) {
        this.articleTitle = articleTitle;
    }

    public Endpoint getEndpoint() {
        return endpoint;
    }

    public void setEndpoint(Endpoint endpoint) {
        this.endpoint = endpoint;
    }

    public CacheEndpoint getCacheEndpoint() {
        return cacheEndpoint;
    }

    public void setCacheEndpoint(CacheEndpoint cacheEndpoint) {
        this.cacheEndpoint = cacheEndpoint;
    }

    public List<ArticleBlock> getBlocks() {
        return blocks;
    }

    public void setBlocks(List<ArticleBlock> blocks) {
        this.blocks = blocks;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
