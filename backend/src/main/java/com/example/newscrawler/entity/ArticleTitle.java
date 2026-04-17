package com.example.newscrawler.entity;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "article_titles")
public class ArticleTitle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "article_id", nullable = false, unique = true)
    private Article article;

    @Column(name = "title_text", nullable = false, columnDefinition = "TEXT")
    private String titleText;

    @Column(name = "title_score")
    private Double titleScore;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    public Long getId() {
        return id;
    }

    public Article getArticle() {
        return article;
    }

    public void setArticle(Article article) {
        this.article = article;
    }

    public String getTitleText() {
        return titleText;
    }

    public void setTitleText(String titleText) {
        this.titleText = titleText;
    }

    public Double getTitleScore() {
        return titleScore;
    }

    public void setTitleScore(Double titleScore) {
        this.titleScore = titleScore;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
