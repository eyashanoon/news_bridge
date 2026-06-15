package com.example.newscrawler.service;

import com.example.newscrawler.dto.FeedPostDTO;
import com.example.newscrawler.entity.Post;
import com.example.newscrawler.entity.PostTag;
import com.example.newscrawler.entity.ReactionType;
import com.example.newscrawler.repository.PostReactionRepository;
import com.example.newscrawler.repository.PostRepository;
import com.example.newscrawler.repository.PostTagRepository;
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

    public SearchService(PostRepository postRepository,
                         PostTagRepository postTagRepository,
                         PostReactionRepository reactionRepository) {
        this.postRepository = postRepository;
        this.postTagRepository = postTagRepository;
        this.reactionRepository = reactionRepository;
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
        Optional<Post> opt = postRepository.findByIdWithArticle(id);
        if (opt.isEmpty()) return null;

        Post post = opt.get();
        List<FeedPostDTO> enriched = enrichPostsWithMetadata(List.of(post));
        return enriched.isEmpty() ? null : enriched.get(0);
    }

    /**
     * Enrich a list of Post entities with tags, likes/dislikes, and converts to FeedPostDTO.
     */
    private List<FeedPostDTO> enrichPostsWithMetadata(List<Post> posts) {
        List<Long> postIds = posts.stream().map(Post::getId).toList();

        // Bulk tags
        List<PostTag> allTags = postTagRepository.findByPostIdIn(postIds);
        Map<Long, List<String>> tagsMap = allTags.stream()
                .collect(Collectors.groupingBy(
                        t -> t.getPost().getId(),
                        Collectors.mapping(PostTag::getTag, Collectors.toList())
                ));

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

        List<FeedPostDTO> result = new ArrayList<>();
        for (Post post : posts) {
            List<String> tagStrings = tagsMap.getOrDefault(post.getId(), List.of());
            long likes = likesMap.getOrDefault(post.getId(), 0L);
            long dislikes = dislikesMap.getOrDefault(post.getId(), 0L);

            result.add(new FeedPostDTO(
                    post.getId(),
                    post.getText(),
                    post.getLabel(),
                    post.getLang(),
                    post.getTitle(),
                    likes,
                    dislikes,
                    null,
                    tagStrings,
                    post.getNumImages(),
                    post.getArticle() != null ? post.getArticle().getId() : null,
                    post.getArticle() != null ? post.getArticle().getUrl() : null,
                    post.getArticle() != null ? post.getArticle().getCreatedAt() : null,
                    post.getTelegramPost().getId()

                    ));
        }

        return result;
    }
}