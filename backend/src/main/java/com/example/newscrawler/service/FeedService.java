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

    private static final int CANDIDATE_POOL_SIZE = 350;
    private static final Map<String, String> CATEGORY_ALIASES = Map.ofEntries(
            Map.entry("general", "General"),
            Map.entry("politics", "Politics"),
            Map.entry("sports", "Sports"),
            Map.entry("finance", "Finance"),
            Map.entry("medical", "Medical"),
            Map.entry("tech", "Tech"),
            Map.entry("culture", "Culture"),
            Map.entry("religion", "Religion")
    );

    private final PostRepository postRepository;
    private final PostTagRepository postTagRepository;
    private final PostReactionRepository reactionRepository;
    private final UserPreferenceRepository preferenceRepository;
    private final PostInteractionRepository interactionRepository;
    private final ArticleBlockRepository articleBlockRepository;
    private final ArticleRepository articleRepository;
    private final GeoScoringService geoScoringService;
    private final LanguageDetectionService languageDetectionService;

    public FeedService(PostRepository postRepository,
                       PostTagRepository postTagRepository,
                       PostReactionRepository reactionRepository,
                       UserPreferenceRepository preferenceRepository,
                       PostInteractionRepository interactionRepository,
                       ArticleBlockRepository articleBlockRepository,
                       ArticleRepository articleRepository,
                       GeoScoringService geoScoringService,
                       LanguageDetectionService languageDetectionService) {
        this.postRepository = postRepository;
        this.postTagRepository = postTagRepository;
        this.reactionRepository = reactionRepository;
        this.preferenceRepository = preferenceRepository;
        this.interactionRepository = interactionRepository;
        this.articleBlockRepository = articleBlockRepository;
        this.articleRepository = articleRepository;
        this.geoScoringService = geoScoringService;
        this.languageDetectionService = languageDetectionService;
    }

    private String normalizeCategory(String category) {
        if (category == null || category.isBlank()) {
            return "General";
        }
        String key = category.trim().toLowerCase();
        return CATEGORY_ALIASES.getOrDefault(key, category.trim());
    }

    private String normalizeLang(String lang) {
        if (lang == null || lang.isBlank()) return "";
        String l = lang.trim().toLowerCase();
        if (l.startsWith("ar")) return "ar";
        if (l.startsWith("en")) return "en";
        return l.length() >= 2 ? l.substring(0, 2) : l;
    }

    private double recencyScore(LocalDateTime createdAt) {
        long hours = Duration.between(createdAt, LocalDateTime.now()).toHours();
        return Math.exp(-hours / 48.0);
    }

    private double popularityScore(long likes, long dislikes) {
        return (likes + 1.0) / (likes + dislikes + 2.0);
    }

    private double normalizeAffinity(double raw) {
        if (raw <= 0) return 0;
        return raw / (1.0 + raw);
    }

    private double languageScore(String detectedPostLang, String userLang) {
        String user = languageDetectionService.normalizeLangCode(userLang);
        String post = languageDetectionService.normalizeLangCode(detectedPostLang);
        if (user.isEmpty()) return 0.5;
        if (post.isEmpty()) return 0.35;
        if (languageDetectionService.languagesMatch(post, user)) return 1.0;

        // Strong preference: mismatching script families sink in the feed
        if ("ar".equals(user) && !"ar".equals(post)) return 0.06;
        if ("en".equals(user) && "ar".equals(post)) return 0.06;

        // Related Latin languages when UI is English
        if ("en".equals(user) && ("es".equals(post) || "fr".equals(post) || "de".equals(post) || "it".equals(post))) {
            return 0.32;
        }
        // Arabic UI: other RTL / non-Latin slightly less penalized than English
        if ("ar".equals(user) && ("he".equals(post) || "ru".equals(post) || "zh".equals(post))) {
            return 0.18;
        }
        return 0.1;
    }

    /**
     * Deprioritize seen posts without removing them. Penalty fades over time and
     * scales with engagement; as the catalog grows, resurfacing old items becomes rarer.
     */
    private double seenMultiplier(PostInteraction interaction, long catalogSize) {
        if (interaction == null) return 1.0;

        int views = Math.max(0, interaction.getViews());
        int clicks = Math.max(0, interaction.getClicks());
        double timeSpent = Math.max(0, interaction.getTotalTimeSpent());

        long hoursSince = 0;
        if (interaction.getLastViewedAt() != null) {
            hoursSince = Duration.between(interaction.getLastViewedAt(), LocalDateTime.now()).toHours();
        }

        double engagement = Math.min(1.0, views * 0.12 + clicks * 0.28 + Math.min(timeSpent / 45.0, 1.5) * 0.15);
        double recovery = 1.0 - Math.exp(-hoursSince / 168.0);
        double catalogFactor = Math.min(1.0, catalogSize / 400.0);

        double penaltyStrength = engagement * (1.0 - recovery * 0.92) * (0.45 + 0.55 * catalogFactor);
        return Math.max(0.06, 1.0 - penaltyStrength * 0.94);
    }

    public List<FeedPostDTO> getRecentPostsForBrief(int limit) {
        Pageable pageable = PageRequest.of(0, limit, Sort.by(Sort.Direction.DESC, "createdAt"));
        List<Post> posts = postRepository.findAllByOrderByCreatedAtDesc(pageable);

        List<Long> postIds = posts.stream().map(Post::getId).toList();
        Map<Long, List<String>> tagsMap = postTagRepository.findTagsByPostIds(postIds);

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

        List<Long> articleIds = posts.stream()
                .map(Post::getArticle)
                .filter(Objects::nonNull)
                .map(Article::getId)
                .distinct()
                .collect(Collectors.toList());

        Map<Long, List<String>> articleImageUrls = loadArticleImages(articleIds);
        Map<Long, String> articleBodyMap = loadArticleBodies(articleIds);

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
            result.add(buildDto(post, tagStrings, likes, dislikes, null, imageUrls, articleBody));
        }

        return result;
    }

    public List<FeedPostDTO> getFeed(AppUser appUser, String category, int limit, int page,
                                     Double userLat, Double userLon, String userLang) {
        String normalizedCategory = normalizeCategory(category);
        boolean isGeneral = "General".equalsIgnoreCase(normalizedCategory);

        List<UserPreference> prefs =
                preferenceRepository.findTop20ByAppUserIdOrderByWeightDesc(appUser.getId());

        Map<String, Double> prefMap = new HashMap<>();
        for (UserPreference p : prefs) {
            prefMap.put(p.getTag().toLowerCase(), p.getWeight());
        }

        long catalogSize = isGeneral
                ? postRepository.countFeedEligiblePosts()
                : postRepository.countFeedEligiblePostsByCategory(normalizedCategory);

        Pageable poolPageable = PageRequest.of(0, CANDIDATE_POOL_SIZE, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Post> candidatesPage = isGeneral
                ? postRepository.findByTagsExtractedTrue(poolPageable)
                : postRepository.findByLabelIgnoreCaseAndTagsExtractedTrue(normalizedCategory, poolPageable);

        List<Post> candidates = candidatesPage.getContent();
        if (candidates.isEmpty()) return List.of();

        // Strict category guard — never surface wrong-category posts on category pages
        if (!isGeneral) {
            candidates = candidates.stream()
                    .filter(p -> p.getLabel() != null
                            && p.getLabel().equalsIgnoreCase(normalizedCategory))
                    .toList();
            if (candidates.isEmpty()) return List.of();
        }

        List<Long> postIds = candidates.stream().map(Post::getId).toList();

        Map<Long, List<String>> tagsMap = postTagRepository.findTagsByPostIds(postIds);

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

        List<PostReaction> userReactions = reactionRepository.findByAppUserIdAndPostIdIn(appUser.getId(), postIds);
        Map<Long, ReactionType> userReactionMap = new HashMap<>();
        for (PostReaction r : userReactions) {
            userReactionMap.put(r.getPost().getId(), r.getReactionType());
        }

        List<PostInteraction> interactions = interactionRepository.findByAppUserIdAndPostIdIn(appUser.getId(), postIds);
        Map<Long, PostInteraction> interactionMap = new HashMap<>();
        for (PostInteraction pi : interactions) {
            interactionMap.put(pi.getPost().getId(), pi);
        }

        List<Long> articleIds = candidates.stream()
                .map(Post::getArticle)
                .filter(Objects::nonNull)
                .map(Article::getId)
                .distinct()
                .collect(Collectors.toList());

        Map<Long, String> articleUrlMap = new HashMap<>();
        Map<Long, String> articleBodyMap = loadArticleBodies(articleIds);
        if (!articleIds.isEmpty()) {
            for (Object[] row : articleRepository.findUrlsByIds(articleIds)) {
                articleUrlMap.put((Long) row[0], (String) row[1]);
            }
        }

        List<PostScoreWrapper> scored = new ArrayList<>();

        for (Post post : candidates) {
            long likes = likesMap.getOrDefault(post.getId(), 0L);
            long dislikes = dislikesMap.getOrDefault(post.getId(), 0L);

            List<String> tags = tagsMap.getOrDefault(post.getId(), List.of());

            double tagAffinity = 0;
            for (String tag : tags) {
                tagAffinity += prefMap.getOrDefault(tag.toLowerCase(), 0.0);
            }

            double categoryAffinity = 0;
            if (isGeneral && post.getLabel() != null) {
                double raw = prefMap.getOrDefault(post.getLabel().toLowerCase(), 0.0);
                categoryAffinity = Math.sqrt(Math.max(0, raw));
            }

            double recency = recencyScore(post.getCreatedAt());
            double popularity = popularityScore(likes, dislikes);
            double exploration = Math.random() * 0.2;

            String articleUrl = post.getArticle() != null
                    ? articleUrlMap.get(post.getArticle().getId())
                    : null;

            double geo = geoScoringService.computeGeoScore(
                    userLat, userLon, normalizedCategory, tags, articleUrl, post.getTitle(), post.getText());
            String articleBody = post.getArticle() != null
                    ? articleBodyMap.getOrDefault(post.getArticle().getId(), "")
                    : "";
            String detectedLang = languageDetectionService.detectLanguage(
                    post.getLang(), post.getTitle(), post.getText(), articleBody);
            double lang = languageScore(detectedLang, userLang);

            double baseScore =
                    0.36 * normalizeAffinity(tagAffinity) +
                            0.18 * normalizeAffinity(categoryAffinity) +
                            0.14 * recency +
                            0.08 * popularity +
                            0.14 * lang +
                            0.05 * geo +
                            0.05 * exploration;

            double seenFactor = seenMultiplier(interactionMap.get(post.getId()), catalogSize);
            double finalScore = baseScore * seenFactor;

            scored.add(new PostScoreWrapper(post, finalScore, likes, dislikes));
        }

        scored.sort((a, b) -> Double.compare(b.score, a.score));

        int start = page * limit;
        if (start >= scored.size()) return List.of();
        int end = Math.min(start + limit, scored.size());
        List<PostScoreWrapper> pageItems = scored.subList(start, end);

        List<Long> pageArticleIds = pageItems.stream()
                .map(w -> w.post.getArticle())
                .filter(Objects::nonNull)
                .map(Article::getId)
                .distinct()
                .collect(Collectors.toList());

        Map<Long, List<String>> articleImageUrls = loadArticleImages(pageArticleIds);

        List<FeedPostDTO> result = new ArrayList<>();
        for (PostScoreWrapper item : pageItems) {
            Post post = item.post;
            ReactionType userReaction = userReactionMap.getOrDefault(post.getId(), null);
            List<String> tagStrings = tagsMap.getOrDefault(post.getId(), List.of());
            List<String> imageUrls = post.getArticle() != null
                    ? articleImageUrls.getOrDefault(post.getArticle().getId(), List.of())
                    : List.of();
            String articleBody = post.getArticle() != null
                    ? articleBodyMap.getOrDefault(post.getArticle().getId(), "")
                    : "";
            result.add(buildDto(post, tagStrings, item.likes, item.dislikes, userReaction, imageUrls, articleBody));
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

    private Map<Long, List<String>> loadArticleImages(List<Long> articleIds) {
        Map<Long, List<String>> articleImageUrls = new HashMap<>();
        if (articleIds.isEmpty()) return articleImageUrls;

        List<ArticleBlock> imageBlocks = articleBlockRepository.findImageBlocksByArticleIds(articleIds);
        for (ArticleBlock block : imageBlocks) {
            articleImageUrls
                    .computeIfAbsent(block.getArticle().getId(), k -> new ArrayList<>())
                    .add(block.getMediaUrl() != null ? block.getMediaUrl() : "");
        }
        articleImageUrls.replaceAll((k, v) -> v.subList(0, Math.min(v.size(), 3)));
        return articleImageUrls;
    }

    private FeedPostDTO buildDto(Post post, List<String> tagStrings, long likes, long dislikes,
                                 ReactionType userReaction, List<String> imageUrls, String articleBody) {
        String detectedLang = languageDetectionService.detectLanguage(
                post.getLang(), post.getTitle(), post.getText(), articleBody);
        return new FeedPostDTO(
                post.getId(),
                post.getText(),
                post.getLabel(),
                post.getLang(),
                detectedLang,
                post.getTitle(),
                likes,
                dislikes,
                userReaction,
                tagStrings,
                post.getNumImages(),
                post.getArticle() != null ? post.getArticle().getId() : null,
                post.getArticle() != null ? post.getArticle().getUrl() : null,
                post.getArticle() != null ? post.getArticle().getCreatedAt() : null,
                post.getTelegramPost() != null ? post.getTelegramPost().getId() : null,
                imageUrls
        );
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
