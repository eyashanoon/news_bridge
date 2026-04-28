package com.example.newscrawler.service;

import com.example.newscrawler.entity.Post;
import com.example.newscrawler.entity.Article;
import com.example.newscrawler.entity.PostTag;
import com.example.newscrawler.dto.CreatePostRequest;
import com.example.newscrawler.dto.PostByTagResponse;
import com.example.newscrawler.repository.PostRepository;
import com.example.newscrawler.repository.ArticleRepository;
import com.example.newscrawler.repository.PostTagRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.Random;
import java.util.List;
import java.util.stream.Collectors;

@Service

public class PostService {
    private final PostRepository postRepository;
    private final ArticleRepository articleRepository;
    private final PostTagRepository postTagRepository;
    private final Random random = new Random();

    public PostService(PostRepository postRepository, ArticleRepository articleRepository, PostTagRepository postTagRepository) {
        this.postRepository = postRepository;
        this.articleRepository = articleRepository;
        this.postTagRepository = postTagRepository;
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

    public Post findById(Long id) {
        return postRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Post not found"));
    }

    public List<PostByTagResponse> findPostsByTags(List<String> tags) {
        // Find all PostTags that match any of the provided tags
        List<PostTag> postTags = postTagRepository.findByTagIn(tags);

        // Map to response DTOs with post ID, matching tag, and timestamp
        return postTags.stream()
                .map(postTag -> new PostByTagResponse(
                        postTag.getPost().getId(),
                        postTag.getTag(),
                        postTag.getPost().getCreatedAt()
                ))
                .collect(Collectors.toList());
    }
}





