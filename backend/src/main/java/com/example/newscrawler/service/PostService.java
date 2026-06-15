package com.example.newscrawler.service;

import com.example.newscrawler.entity.Article;
import com.example.newscrawler.entity.Post;
import com.example.newscrawler.entity.TelegramPost;
import com.example.newscrawler.dto.CreatePostRequest;
import com.example.newscrawler.dto.PostByTagResponse;
import com.example.newscrawler.repository.CommentRepository;
import com.example.newscrawler.repository.PostInteractionRepository;
import com.example.newscrawler.repository.PostReactionRepository;
import com.example.newscrawler.repository.PostRepository;
import com.example.newscrawler.repository.ArticleRepository;
import com.example.newscrawler.repository.PostTagRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.Random;
import java.util.List;
import java.util.stream.Collectors;

@Service

public class PostService {
    private final PostRepository postRepository;
    private final ArticleRepository articleRepository;
    private final PostTagRepository postTagRepository;
    private final PostReactionRepository postReactionRepository;
    private final PostInteractionRepository postInteractionRepository;
    private final CommentRepository commentRepository;
    private final PostVisibilityService postVisibilityService;
    private final Random random = new Random();

    public PostService(
            PostRepository postRepository,
            ArticleRepository articleRepository,
            PostTagRepository postTagRepository,
            PostReactionRepository postReactionRepository,
            PostInteractionRepository postInteractionRepository,
            CommentRepository commentRepository,
            PostVisibilityService postVisibilityService) {
        this.postRepository = postRepository;
        this.articleRepository = articleRepository;
        this.postTagRepository = postTagRepository;
        this.postReactionRepository = postReactionRepository;
        this.postInteractionRepository = postInteractionRepository;
        this.commentRepository = commentRepository;
        this.postVisibilityService = postVisibilityService;
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

    @Transactional
    public void deletePostsForArticle(Long articleId) {
        for (Post post : postRepository.findByArticle_Id(articleId)) {
            Long postId = post.getId();
            postReactionRepository.deleteByPost_Id(postId);
            postInteractionRepository.deleteByPost_Id(postId);
            commentRepository.deleteRepliesByPostId(postId);
            commentRepository.deleteAllByPostId(postId);
            postTagRepository.deleteByPostId(postId);
            postRepository.delete(post);
        }
    }

    public Post createFromTelegramPost(TelegramPost telegramPost) {
        Post post = new Post();
        post.setTelegramPost(telegramPost);
        String content = telegramPost.getContent() != null ? telegramPost.getContent() : "";
        post.setText(content);
        String firstLine = content.lines().findFirst().orElse("").strip();
        post.setTitle(firstLine.length() > 120 ? firstLine.substring(0, 120) : firstLine);
        post.setNumImages("photo".equals(telegramPost.getMediaType()) ? 1 : 0);
        return postRepository.save(post);
    }

    public Post findById(Long id) {
        return postVisibilityService.requireVisiblePost(id);
    }

    private List<String> normalizeTags(List<String> tags) {
        return tags.stream()
                .filter(tag -> tag != null && !tag.isBlank())
                .map(tag -> tag.trim().toLowerCase())
                .distinct()
                .collect(Collectors.toList());
    }

    public List<PostByTagResponse> findPostsByTags(List<String> tags) {
        List<String> normalized = normalizeTags(tags);
        if (normalized.isEmpty()) {
            return List.of();
        }
        return postTagRepository.findVisibleTagRowsByTagIn(normalized).stream()
                .map(this::toPostByTagResponse)
                .collect(Collectors.toList());
    }

    /**
     * Find the most recent posts matching the given tags, limited to `limit` results.
     * Returns unique postIds sorted by timestamp descending (newest first).
     */
    public List<PostByTagResponse> findRecentPostsByTags(List<String> tags, int limit) {
        List<String> normalized = normalizeTags(tags);
        if (normalized.isEmpty()) {
            return List.of();
        }

        return postTagRepository.findVisibleTagRowsByTagIn(normalized).stream()
                .map(this::toPostByTagResponse)
                .collect(Collectors.groupingBy(PostByTagResponse::getPostId))
                .values().stream()
                .map(group -> group.stream().findFirst().orElse(null))
                .filter(java.util.Objects::nonNull)
                .sorted((a, b) -> {
                    if (a.getTimestamp() == null) return 1;
                    if (b.getTimestamp() == null) return -1;
                    return b.getTimestamp().compareTo(a.getTimestamp());
                })
                .limit(limit)
                .collect(Collectors.toList());
    }

    private PostByTagResponse toPostByTagResponse(Object[] row) {
        Long postId = ((Number) row[0]).longValue();
        String tag = (String) row[1];
        LocalDateTime timestamp = row[2] instanceof LocalDateTime
                ? (LocalDateTime) row[2]
                : row[2] instanceof java.sql.Timestamp
                    ? ((java.sql.Timestamp) row[2]).toLocalDateTime()
                    : null;
        return new PostByTagResponse(postId, tag, timestamp);
    }
}





