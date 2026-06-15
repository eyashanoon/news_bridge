package com.example.newscrawler.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "channel_tags", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"channel_id", "tag", "source"})
})
public class ChannelTag {

    public enum TagSource {
        ADMIN_DESC,
        TAG_SERVICE,
        POSTS,
        QUESTIONNAIRE
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "channel_id", nullable = false)
    private TelegramChannel channel;

    @Column(nullable = false)
    private String tag;

    @Column(nullable = false)
    private double weight = 1.0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TagSource source;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public TelegramChannel getChannel() { return channel; }
    public void setChannel(TelegramChannel channel) { this.channel = channel; }

    public String getTag() { return tag; }
    public void setTag(String tag) { this.tag = tag; }

    public double getWeight() { return weight; }
    public void setWeight(double weight) { this.weight = weight; }

    public TagSource getSource() { return source; }
    public void setSource(TagSource source) { this.source = source; }
}
