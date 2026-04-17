package com.example.newscrawler.entity;

import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "article_text_blocks")
@DiscriminatorValue("TEXT")
public class ArticleTextBlock extends ArticleBlock {

    @Column(name = "text_content", columnDefinition = "TEXT")
    private String textContent;

    @Override
    public ArticleBlockType getBlockType() {
        return ArticleBlockType.TEXT;
    }

    @Override
    public String getTextContent() {
        return textContent;
    }

    @Override
    public void setTextContent(String textContent) {
        this.textContent = textContent;
    }

    @Override
    public String getMediaUrl() {
        return null;
    }

    @Override
    public void setMediaUrl(String mediaUrl) {
    }

    @Override
    public String getAltText() {
        return null;
    }

    @Override
    public void setAltText(String altText) {
    }
}
