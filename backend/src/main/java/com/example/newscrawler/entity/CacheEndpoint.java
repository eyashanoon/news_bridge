package com.example.newscrawler.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.time.LocalDateTime;

@Entity
@Table(
    name = "cache_endpoints",
    uniqueConstraints = @UniqueConstraint(columnNames = {"endpoint_id", "url"})
)
public class CacheEndpoint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 2048)
    private String url;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AnalysisResult result;

    @Column(columnDefinition = "TEXT")
    private String extractedText;

    @Column(columnDefinition = "TEXT")
    private String extractedTitle;

    @Column(columnDefinition = "LONGTEXT")
    private String extractedContentJson;

    @Column(columnDefinition = "TEXT")
    private String domPattern;

    @ManyToOne
    @JoinColumn(name = "endpoint_id", nullable = false)
    private Endpoint sourceEndpoint;

    @Column(nullable = false)
    private LocalDateTime analyzedAt;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    public CacheEndpoint() {
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public AnalysisResult getResult() {
        return result;
    }

    public void setResult(AnalysisResult result) {
        this.result = result;
    }

    public String getExtractedText() {
        return extractedText;
    }

    public void setExtractedText(String extractedText) {
        this.extractedText = extractedText;
    }

    public String getExtractedTitle() {
        return extractedTitle;
    }

    public void setExtractedTitle(String extractedTitle) {
        this.extractedTitle = extractedTitle;
    }

    public String getExtractedContentJson() {
        return extractedContentJson;
    }

    public void setExtractedContentJson(String extractedContentJson) {
        this.extractedContentJson = extractedContentJson;
    }

    public String getDomPattern() {
        return domPattern;
    }

    public void setDomPattern(String domPattern) {
        this.domPattern = domPattern;
    }

    public Endpoint getSourceEndpoint() {
        return sourceEndpoint;
    }

    public void setSourceEndpoint(Endpoint sourceEndpoint) {
        this.sourceEndpoint = sourceEndpoint;
    }

    public LocalDateTime getAnalyzedAt() {
        return analyzedAt;
    }

    public void setAnalyzedAt(LocalDateTime analyzedAt) {
        this.analyzedAt = analyzedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}
