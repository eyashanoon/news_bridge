package com.example.newscrawler.entity;

import java.time.Instant;

import org.hibernate.annotations.CreationTimestamp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.DiscriminatorColumn;
import jakarta.persistence.DiscriminatorType;
import jakarta.persistence.Inheritance;
import jakarta.persistence.InheritanceType;
import jakarta.persistence.EnumType;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "article_blocks")
@Inheritance(strategy = InheritanceType.JOINED)
@DiscriminatorColumn(name = "block_kind", discriminatorType = DiscriminatorType.STRING, length = 32)
public abstract class ArticleBlock {

    @Id
    @jakarta.persistence.GeneratedValue(strategy = jakarta.persistence.GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "article_id", nullable = false)
    private Article article;

    @Column(name = "sort_order", nullable = false)
    private Integer sortOrder;

    @Column(name = "score")
    private Double score;

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

    public Integer getSortOrder() {
        return sortOrder;
    }

    public void setSortOrder(Integer sortOrder) {
        this.sortOrder = sortOrder;
    }

    public Double getScore() {
        return score;
    }

    public void setScore(Double score) {
        this.score = score;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public abstract ArticleBlockType getBlockType();

    public abstract String getTextContent();

    public abstract void setTextContent(String textContent);

    public abstract String getMediaUrl();

    public abstract void setMediaUrl(String mediaUrl);

    public abstract String getAltText();

    public abstract void setAltText(String altText);
}
