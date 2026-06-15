package com.example.newscrawler.service;

import com.example.newscrawler.entity.Post;
import com.example.newscrawler.repository.PostRepository;
import com.example.newscrawler.util.PostVisibility;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PostVisibilityService {

    private final PostRepository postRepository;

    public PostVisibilityService(PostRepository postRepository) {
        this.postRepository = postRepository;
    }

    @Transactional(readOnly = true)
    public void requireVisible(Long postId) {
        Post post = postRepository.findByIdWithArticleAndSource(postId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found"));

        if (!PostVisibility.isVisibleToUsers(post)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found");
        }
    }

    @Transactional(readOnly = true)
    public Post requireVisiblePost(Long postId) {
        Post post = postRepository.findByIdWithArticleAndSource(postId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found"));

        if (!PostVisibility.isVisibleToUsers(post)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found");
        }

        return post;
    }
}
