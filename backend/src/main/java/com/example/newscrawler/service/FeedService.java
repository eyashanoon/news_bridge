package com.example.newscrawler.service;

import com.example.newscrawler.dto.FeedPostDTO;
import com.example.newscrawler.entity.*;
import com.example.newscrawler.repository.*;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class FeedService {

    private final PostRepository postRepository;
    private final PostTagRepository postTagRepository;
    private final PostReactionRepository reactionRepository;
    private final UserPreferenceRepository preferenceRepository;
    private final PostInteractionRepository interactionRepository;

    public FeedService(PostRepository postRepository,
                       PostTagRepository postTagRepository,
                       PostReactionRepository reactionRepository,
                       UserPreferenceRepository preferenceRepository,
                       PostInteractionRepository interactionRepository) {
        this.postRepository = postRepository;
        this.postTagRepository = postTagRepository;
        this.reactionRepository = reactionRepository;
        this.preferenceRepository = preferenceRepository;
        this.interactionRepository = interactionRepository;
    }

    private double recencyScore(LocalDateTime createdAt) {
        long hours = Duration.between(createdAt, LocalDateTime.now()).toHours();
        return Math.exp(-hours / 48.0);
    }

    private double popularityScore(long likes, long dislikes) {
        return (likes + 1.0) / (likes + dislikes + 2.0);
    }

    public List<FeedPostDTO> getFeed(AppUser AppUser, String category, int limit, int page) {

        // AppUser preferences
        List<UserPreference> prefs =
                preferenceRepository.findTop20ByAppUserIdOrderByWeightDesc(AppUser.getId());

        Map<String, Double> prefMap = new HashMap<>();
        for (UserPreference p : prefs) {
            prefMap.put(p.getTag().toLowerCase(), p.getWeight());
        }

        // seen posts
        List<Long> seenPostIds = interactionRepository.findSeenPostIdsByAppUserId(AppUser.getId());

        // pagination
        Pageable pageable = PageRequest.of(page, limit, Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<Post> candidatesPage;

        // IMPORTANT: if AppUser has seen nothing, use normal query
        if (seenPostIds.isEmpty()) {
            if ("General".equalsIgnoreCase(category)) {
                candidatesPage = postRepository.findByTagsExtractedTrue(pageable);
            } else {
                candidatesPage = postRepository.findByLabelIgnoreCaseAndTagsExtractedTrue(category, pageable);
            }
        } else {
            if ("General".equalsIgnoreCase(category)) {
                candidatesPage = postRepository.findByTagsExtractedTrueAndIdNotIn(seenPostIds, pageable);
            } else {
                candidatesPage = postRepository.findByLabelIgnoreCaseAndTagsExtractedTrueAndIdNotIn(category, seenPostIds, pageable);
            }
        }

        List<Post> candidates = candidatesPage.getContent();

        if (candidates.isEmpty()) return List.of();

        List<Long> postIds = candidates.stream().map(Post::getId).toList();

        // BULK tags
        List<PostTag> allTags = postTagRepository.findByPostIdIn(postIds);

        Map<Long, List<String>> tagsMap = allTags.stream()
                .collect(Collectors.groupingBy(
                        t -> t.getPost().getId(),
                        Collectors.mapping(PostTag::getTag, Collectors.toList())
                ));

        // BULK reaction counts
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

        // BULK AppUser reactions
        List<PostReaction> userReactions = reactionRepository.findByAppUserIdAndPostIdIn(AppUser.getId(), postIds);

        Map<Long, ReactionType> userReactionMap = new HashMap<>();
        for (PostReaction r : userReactions) {
            userReactionMap.put(r.getPost().getId(), r.getReactionType());
        }

        // scoring
        List<PostScoreWrapper> scored = new ArrayList<>();

        for (Post post : candidates) {

            long likes = likesMap.getOrDefault(post.getId(), 0L);
            long dislikes = dislikesMap.getOrDefault(post.getId(), 0L);

            double popularity = popularityScore(likes, dislikes);
            double recency = recencyScore(post.getCreatedAt());

            List<String> tags = tagsMap.getOrDefault(post.getId(), List.of());

            double tagAffinity = 0;
            for (String tag : tags) {
                tagAffinity += prefMap.getOrDefault(tag.toLowerCase(), 0.0);
            }

            double categoryAffinity = prefMap.getOrDefault(post.getLabel().toLowerCase(), 0.0);

            double exploration = Math.random() * 0.2;

            double score =
                    0.45 * tagAffinity +
                            0.25 * categoryAffinity +
                            0.15 * recency +
                            0.10 * popularity +
                            0.05 * exploration;

            scored.add(new PostScoreWrapper(post, score, likes, dislikes));
        }

        scored.sort((a, b) -> Double.compare(b.score, a.score));

        // DTO
        List<FeedPostDTO> result = new ArrayList<>();

        for (PostScoreWrapper item : scored) {
            Post post = item.post;

            ReactionType userReaction = userReactionMap.getOrDefault(post.getId(), null);

            List<String> tagStrings = tagsMap.getOrDefault(post.getId(), List.of());

            result.add(new FeedPostDTO(
                    post.getId(),
                    post.getText(),
                    post.getLabel(),
                    post.getLang(),
                    post.getTitle(),
                    item.likes,
                    item.dislikes,
                    userReaction,
                    tagStrings,
                    post.getNumImages(), post.getArticle() != null ? post.getArticle().getId() : null
            ));
        }

        return result;
    }

    private static class PostScoreWrapper {
        Post post;
        double score;
        long likes;
        long dislikes;

        PostScoreWrapper(Post post, double score, long likes, long dislikes) {
            this.post = post;
            this.score = score;
            this.likes = likes;
            this.dislikes = dislikes;
        }
    }
}





