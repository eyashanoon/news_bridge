package com.example.newscrawler.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "telegram_post_tags", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"telegram_post_id", "tag"})
})
public class TelegramPostTag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "telegram_post_id", nullable = false)
    private TelegramPost telegramPost;

    @Column(nullable = false)
    private String tag;

    public TelegramPostTag() {}

    public TelegramPostTag(TelegramPost telegramPost, String tag) {
        this.telegramPost = telegramPost;
        this.tag = tag.toLowerCase();
    }

    public Long getId() { return id; }
    public TelegramPost getTelegramPost() { return telegramPost; }
    public void setTelegramPost(TelegramPost telegramPost) { this.telegramPost = telegramPost; }
    public String getTag() { return tag; }
    public void setTag(String tag) { this.tag = tag; }
}
