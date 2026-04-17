package com.example.newscrawler.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "PostTags",
        uniqueConstraints = @UniqueConstraint(columnNames = {"post_id", "tag"}))
public class PostTag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    private Post post;

    @Column(nullable = false)
    private String tag;

    public PostTag() {}

    public PostTag(Post post, String tag) {
        this.post = post;
        this.tag = tag;
    }

    public Long getId() { return id; }

    public Post getPost() { return post; }
    public String getTag() { return tag; }
}





