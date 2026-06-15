package com.example.newscrawler.service;

import com.example.newscrawler.dto.FeedPostDTO;
import com.example.newscrawler.entity.*;
import com.example.newscrawler.repository.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class SearchService {

    private final PostRepository postRepository;
    private final PostTagRepository postTagRepository;
    private final PostReactionRepository reactionRepository;
    private final ArticleBlockRepository articleBlockRepository;
    private final ArticleRepository articleRepository;
    private final PostVisibilityService postVisibilityService;
    private final LanguageDetectionService languageDetectionService;

    public SearchService(PostRepository postRepository,
                         PostTagRepository postTagRepository,
                         PostReactionRepository reactionRepository,
                         ArticleBlockRepository articleBlockRepository,
                         ArticleRepository articleRepository,
                         PostVisibilityService postVisibilityService,
                         LanguageDetectionService languageDetectionService) {
        this.postRepository = postRepository;
        this.postTagRepository = postTagRepository;
        this.reactionRepository = reactionRepository;
        this.articleBlockRepository = articleBlockRepository;
        this.articleRepository = articleRepository;
        this.postVisibilityService = postVisibilityService;
        this.languageDetectionService = languageDetectionService;
    }

    /**
     * Search all posts by keyword, with optional category/language filters.
     * Searches across ALL posts regardless of tagsExtracted or seen status.
     */
    public List<FeedPostDTO> searchPosts(
            String query,
            String category,
            String lang,
            int page,
            int limit
    ) {
        Pageable pageable = PageRequest.of(page, limit, Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<Post> postPage;

        if (query == null || query.trim().isEmpty()) {
            // No query: return recent posts with optional filters
            List<Post> posts;
            if (category != null && !category.isEmpty()) {
                if (lang != null && !lang.isEmpty()) {
                    posts = postRepository.findByLabelIgnoreCaseAndLangOrderByCreatedAtDesc(category, lang, pageable).getContent();
                } else {
                    posts = postRepository.findByLabelIgnoreCaseOrderByCreatedAtDesc(category, pageable);
                }
            } else if (lang != null && !lang.isEmpty()) {
                posts = postRepository.findByLangOrderByCreatedAtDesc(lang, pageable).getContent();
            } else {
                posts = postRepository.findAllByOrderByCreatedAtDesc(pageable);
            }
            if (posts.isEmpty()) return List.of();
            return enrichPostsWithMetadata(posts);
        } else {
            // Has search query
            String q = query.trim().toLowerCase();

            if (category != null && !category.isEmpty() && lang != null && !lang.isEmpty()) {
                postPage = postRepository.searchByQueryAndCategoryAndLang(q, category, lang, pageable);
            } else if (category != null && !category.isEmpty()) {
                postPage = postRepository.searchByQueryAndCategory(q, category, pageable);
            } else if (lang != null && !lang.isEmpty()) {
                postPage = postRepository.searchByQueryAndLang(q, lang, pageable);
            } else {
                postPage = postRepository.searchByQuery(q, pageable);
            }
        }

        List<Post> posts = postPage.getContent();
        if (posts.isEmpty()) return List.of();

        return enrichPostsWithMetadata(posts);
    }

    /**
     * Get a single post by ID with full details.
     */
    public FeedPostDTO getPostById(Long id) {
        try {
            Post post = postVisibilityService.requireVisiblePost(id);
            List<FeedPostDTO> enriched = enrichPostsWithMetadata(List.of(post));
            return enriched.isEmpty() ? null : enriched.get(0);
        } catch (org.springframework.web.server.ResponseStatusException ex) {
            return null;
        }
    }

    /** Public helper for other services (e.g. saved posts). */
    public List<FeedPostDTO> enrichPosts(List<Post> posts) {
        if (posts == null || posts.isEmpty()) {
            return List.of();
        }
        return enrichPostsWithMetadata(posts);
    }

    /**
     * Enrich a list of Post entities with tags, likes/dislikes, and converts to FeedPostDTO.
     */
    private List<FeedPostDTO> enrichPostsWithMetadata(List<Post> posts) {
        List<Long> postIds = posts.stream().map(Post::getId).toList();

        // Bulk tags
        Map<Long, List<String>> tagsMap = postTagRepository.findTagsByPostIds(postIds);

        // Bulk reaction counts
        List<Object[]> reactionCounts = reactionRepository.countReactionsForPosts(postIds);
        Map<Long, Long> likesMap = new HashMap<>();
        Map<Long, Long> dislikesMap = new HashMap<>();
        for (Object[] row : reactionCounts) {
            Long postId = (Long) row[0];
            ReactionType type = (ReactionType) row[1];
            Long count = (Long) row[2];
            if (type == ReactionType.LIKE) likesMap.put(postId, count);
            if (type == ReactionType.DISLIKE) dislikesMap.put(postId, count);
        }

        // Fetch image URLs for articles
        List<Long> articleIds = posts.stream()
                .map(Post::getArticle)
                .filter(Objects::nonNull)
                .map(Article::getId)
                .distinct()
                .collect(Collectors.toList());

        Map<Long, List<String>> articleImageUrls = new HashMap<>();
        Map<Long, String> articleBodyMap = loadArticleBodies(articleIds);
        if (!articleIds.isEmpty()) {
            List<ArticleBlock> imageBlocks = articleBlockRepository.findImageBlocksByArticleIds(articleIds);
            for (ArticleBlock block : imageBlocks) {
                articleImageUrls
                    .computeIfAbsent(block.getArticle().getId(), k -> new ArrayList<>())
                    .add(block.getMediaUrl() != null ? block.getMediaUrl() : "");
            }
            articleImageUrls.replaceAll((k, v) -> v.subList(0, Math.min(v.size(), 3)));
        }

        List<FeedPostDTO> result = new ArrayList<>();
        for (Post post : posts) {
            List<String> tagStrings = tagsMap.getOrDefault(post.getId(), List.of());
            long likes = likesMap.getOrDefault(post.getId(), 0L);
            long dislikes = dislikesMap.getOrDefault(post.getId(), 0L);
            List<String> imageUrls = post.getArticle() != null
                    ? articleImageUrls.getOrDefault(post.getArticle().getId(), List.of())
                    : List.of();

                    String articleBody = post.getArticle() != null
                            ? articleBodyMap.getOrDefault(post.getArticle().getId(), "")
                            : "";
                    String detectedLang = languageDetectionService.detectLanguage(
                            post.getLang(), post.getTitle(), post.getText(), articleBody);
                    result.add(new FeedPostDTO(
                            post.getId(),
                            post.getText(),
                            post.getLabel(),
                            post.getLang(),
                            detectedLang,
                            post.getTitle(),
                            likes,
                            dislikes,
                            null,
                            tagStrings,
                            post.getNumImages(),
                            post.getArticle() != null ? post.getArticle().getId() : null,
                            post.getArticle() != null ? post.getArticle().getUrl() : null,
                            post.getArticle() != null ? post.getArticle().getCreatedAt() : null,
                            post.getTelegramPost() != null ? post.getTelegramPost().getId() : null,
                            imageUrls
                            ));
        }

        return result;
    }

    private Map<Long, String> loadArticleBodies(List<Long> articleIds) {
        Map<Long, StringBuilder> buffers = new HashMap<>();
        if (articleIds.isEmpty()) {
            return Map.of();
        }

        for (Object[] row : articleRepository.findTextsByIds(articleIds)) {
            Long id = (Long) row[0];
            String text = (String) row[1];
            if (text != null && !text.isBlank()) {
                buffers.computeIfAbsent(id, k -> new StringBuilder()).append(text);
            }
        }

        for (var block : articleBlockRepository.findTextBlocksByArticleIds(articleIds)) {
            String text = block.getTextContent();
            if (text == null || text.isBlank()) continue;
            Long id = block.getArticle().getId();
            StringBuilder sb = buffers.computeIfAbsent(id, k -> new StringBuilder());
            if (!sb.isEmpty()) sb.append('\n');
            sb.append(text);
        }

        Map<Long, String> result = new HashMap<>();
        buffers.forEach((id, sb) -> result.put(id, sb.toString()));
        return result;
    }
}