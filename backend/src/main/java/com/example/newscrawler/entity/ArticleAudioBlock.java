package com.example.newscrawler.entity;

import jakarta.persistence.Column;
import jakarta.persistence.DiscriminatorValue;
import jakarta.persistence.Entity;

import jakarta.persistence.PrimaryKeyJoinColumn;

@Entity
@DiscriminatorValue("AUDIO")
@PrimaryKeyJoinColumn(name = "id")
public class ArticleAudioBlock extends AbstractMediaArticleBlock {

    @Column(name = "media_url", length = 2048)
    private String mediaUrl;

    @Column(name = "alt_text", columnDefinition = "TEXT")
    private String altText;

    @Override
    public ArticleBlockType getBlockType() {
        return ArticleBlockType.AUDIO;
    }

    @Override
    public String getMediaUrl() {
        return mediaUrl;
    }

    @Override
    public void setMediaUrl(String mediaUrl) {
        this.mediaUrl = mediaUrl;
    }

    @Override
    public String getAltText() {
        return altText;
    }

    @Override
    public void setAltText(String altText) {
        this.altText = altText;
    }

    @Override
    public String getTextContent() {
        return null;
    }

    @Override
    public void setTextContent(String textContent) {
    }
}
