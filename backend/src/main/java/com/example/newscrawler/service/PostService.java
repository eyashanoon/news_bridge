package com.example.newscrawler.service;

import com.example.newscrawler.entity.Post;
import com.example.newscrawler.entity.Article;
import com.example.newscrawler.dto.CreatePostRequest;
import com.example.newscrawler.repository.PostRepository;
import com.example.newscrawler.repository.ArticleRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.Random;

@Service

public class PostService {
    private final PostRepository postRepository;
    private final ArticleRepository articleRepository;
    private final Random random = new Random();

    public PostService(PostRepository postRepository, ArticleRepository articleRepository) {
        this.postRepository = postRepository;
        this.articleRepository = articleRepository;
    }

    public Optional<Post> getRandomPost(String category) {

        // choose a random page number to avoid loading all posts
        int page = random.nextInt(20); // random page range (adjust if needed)
        Pageable pageable = PageRequest.of(page, 10);

        Page<Post> postsPage;

        if ("General".equalsIgnoreCase(category)) {
            postsPage = postRepository.findByTagsExtractedTrue(pageable);
        } else {
            postsPage = postRepository.findByLabelIgnoreCaseAndTagsExtractedTrue(category, pageable);
        }

        if (postsPage.isEmpty()) {
            return Optional.empty();
        }

        var posts = postsPage.getContent();
        Post randomPost = posts.get(random.nextInt(posts.size()));

        return Optional.of(randomPost);
    }

    public Post createPost(CreatePostRequest request) {
        Article article = articleRepository.findById(request.articleId())
                .orElseThrow(() -> new RuntimeException("Article not found"));
        Post post = new Post();
        post.setText(request.text());
        post.setLabel(request.label());
        post.setLang(request.lang());
        post.setTitle(request.title());
        post.setNumImages(request.numImages());
        post.setArticle(article);
        return postRepository.save(post);
    }

    public java.util.List<Post> findByArticleId(Long articleId) {
        return postRepository.findByArticle_Id(articleId);
    }
}





