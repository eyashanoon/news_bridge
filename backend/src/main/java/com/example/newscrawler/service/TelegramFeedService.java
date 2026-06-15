package com.example.newscrawler.service;

import com.example.newscrawler.dto.TelegramChannelBrowseDto;
import com.example.newscrawler.dto.TelegramFeedPostDto;
import com.example.newscrawler.entity.*;
import com.example.newscrawler.repository.*;
import com.example.newscrawler.util.TagVectorUtils;
import com.example.newscrawler.util.TelegramEngagementTagResolver;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Telegram-only feed for Special News. Learns content-topic preferences from Telegram
 * engagement and blends with site article tag preferences when Telegram signal is weak.
 */
@Service
public class TelegramFeedService {

    private static final int MAX_POSTS_PER_CHANNEL_PER_PAGE = 3;
    private static final double MIN_SITE_BLEND = 0.15;

    private final TelegramPostRepository postRepo;
    private final TelegramChannelRepository channelRepo;
    private final ChannelPreferenceProfileRepository profileRepo;
    private final UserTelegramContentPreferenceRepository contentPrefRepo;
    private final UserPreferenceRepository sitePrefRepo;
    private final TelegramPostTagRepository postTagRepo;
    private final ChannelScoringService scoringService;
    private final TelegramEngagementEventRepository engagementRepo;

    public TelegramFeedService(TelegramPostRepository postRepo,
                               TelegramChannelRepository channelRepo,
                               ChannelPreferenceProfileRepository profileRepo,
                               UserTelegramContentPreferenceRepository contentPrefRepo,
                               UserPreferenceRepository sitePrefRepo,
                               TelegramPostTagRepository postTagRepo,
                               ChannelScoringService scoringService,
                               TelegramEngagementEventRepository engagementRepo) {
        this.postRepo = postRepo;
        this.channelRepo = channelRepo;
        this.profileRepo = profileRepo;
        this.contentPrefRepo = contentPrefRepo;
        this.sitePrefRepo = sitePrefRepo;
        this.postTagRepo = postTagRepo;
        this.scoringService = scoringService;
        this.engagementRepo = engagementRepo;
    }

    /**
     * Tab 1 — personalized by Telegram engagement, balanced with site tag preferences.
     */
    @Transactional(readOnly = true)
    public List<TelegramFeedPostDto> getForYouFeed(AppUser user, int limit, int page, List<Long> excludeIds) {
        List<TelegramChannel> activeChannels = channelRepo.findByStatus(RecordStatus.ACTIVE);
        if (activeChannels.isEmpty()) return List.of();

        Map<String, Double> telegramVec = loadUserContentVector(user);
        Map<String, Double> siteVec = loadSitePreferenceVector(user);
        double telegramWeight = computeTelegramBlendWeight(telegramVec, user);

        Map<Long, Map<String, Double>> channelProfiles = loadChannelProfileVectors(activeChannels);
        Map<Long, Double> channelScores = buildBlendedChannelScores(
                activeChannels, channelProfiles, telegramVec, siteVec, telegramWeight);

        return fetchPersonalizedPosts(
                channelScores, telegramVec, siteVec, telegramWeight, limit, page, excludeIds, true);
    }

    /** Tab 2 — one page of posts from a single channel. */
    public List<TelegramFeedPostDto> getByChannelFeed(Long channelId, int limit, int page, List<Long> excludeIds) {
        TelegramChannel ch = channelRepo.findById(channelId).orElse(null);
        if (ch == null || ch.getStatus() != RecordStatus.ACTIVE) return List.of();

        Set<Long> exclude = toExcludeSet(excludeIds);
        var batch = postRepo.findByChannel_Id(channelId,
                PageRequest.of(page, limit, Sort.by(Sort.Direction.DESC, "messageDate")));
        List<TelegramPost> posts = batch.getContent().stream()
                .filter(p -> !exclude.contains(p.getId()))
                .toList();
        return toDtos(posts, Map.of());
    }

    /**
     * Tab 3 — discover by extracted post tags, post text, and channel admin profiles.
     */
    @Transactional(readOnly = true)
    public List<TelegramFeedPostDto> discoverByContent(String query, int limit, int page, List<Long> excludeIds) {
        if (query == null || query.isBlank()) return List.of();

        String q = query.trim().toLowerCase();
        Set<Long> exclude = toExcludeSet(excludeIds);
        Map<String, Double> queryVector = buildQueryVector(q);
        Map<Long, Double> postScores = new LinkedHashMap<>();

        for (Long postId : postTagRepo.findPostIdsByTagLike(q)) {
            if (!exclude.contains(postId)) postScores.merge(postId, 4.0, Math::max);
        }

        for (String word : q.split("\\s+")) {
            if (word.length() < 2) continue;
            for (Long postId : postTagRepo.findPostIdsByTagLike(word)) {
                if (!exclude.contains(postId)) postScores.merge(postId, 3.5, Math::max);
            }
        }

        int searchBatch = 40 + page * 30;
        for (TelegramPost p : postRepo.searchActiveByContent(q, PageRequest.of(page, searchBatch))) {
            if (exclude.contains(p.getId())) continue;
            double textScore = 2.0;
            if (p.getContent() != null && p.getContent().toLowerCase().contains(q)) {
                textScore += 1.0;
            }
            postScores.merge(p.getId(), textScore, Double::sum);
        }

        List<TelegramChannel> activeChannels = channelRepo.findByStatus(RecordStatus.ACTIVE);
        Map<Long, Double> channelScores = new HashMap<>();
        for (TelegramChannel ch : activeChannels) {
            double chScore = scoreChannelForQuery(ch, q, queryVector);
            if (chScore > 0) channelScores.put(ch.getId(), chScore);
        }

        if (postScores.isEmpty() && !channelScores.isEmpty()) {
            return fetchPersonalizedPosts(
                    channelScores, Map.of(), Map.of(), 0.0, limit, page, excludeIds, true);
        }
        if (postScores.isEmpty()) return List.of();

        List<ScoredPost> scored = new ArrayList<>();
        for (Map.Entry<Long, Double> e : postScores.entrySet()) {
            TelegramPost p = postRepo.findById(e.getKey()).orElse(null);
            if (p == null || p.getChannel().getStatus() != RecordStatus.ACTIVE) continue;

            double tagScore = e.getValue();
            double chBoost = channelScores.getOrDefault(p.getChannel().getId(), 0.0) * 0.5;
            double recency = recencyScore(p.getMessageDate());
            double total = tagScore + chBoost + recency * 0.4;
            scored.add(new ScoredPost(p, total));
        }

        scored.sort(Comparator.comparingDouble(ScoredPost::score).reversed());
        List<ScoredPost> pageSlice = pickTopWithSoftDiversity(
                scored.stream().skip((long) page * limit).toList(),
                limit,
                MAX_POSTS_PER_CHANNEL_PER_PAGE);
        return toDtos(pageSlice.stream().map(ScoredPost::post).toList(),
                pageSlice.stream().collect(Collectors.toMap(sp -> sp.post().getId(), ScoredPost::score, (a, b) -> a)));
    }

    public List<String> getPopularTags(int limit) {
        return postTagRepo.findPopularTags(PageRequest.of(0, limit)).stream()
                .map(row -> (String) row[0])
                .filter(Objects::nonNull)
                .collect(Collectors.toList());
    }

    public List<TelegramChannelBrowseDto> browseChannels(String query) {
        List<TelegramChannel> channels;
        if (query != null && !query.isBlank()) {
            channels = channelRepo.searchActiveByName(query.trim());
        } else {
            channels = channelRepo.findByStatus(RecordStatus.ACTIVE);
        }

        return channels.stream()
                .map(this::toBrowseDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public void recordContentEngagement(AppUser user, Long channelId, double delta) {
        recordContentEngagement(user, channelId, null, delta, null);
    }

    @Transactional
    public void recordContentEngagement(AppUser user, Long channelId, Long postId, double delta, Double feedScore) {
        Map<String, Double> tagVec = resolveEngagementVector(channelId, postId);
        logEngagementEvent(
                user.getId(), channelId, postId, delta, feedScore,
                TelegramEngagementEvent.EventType.VIEW, tagVec);
        applyChannelPreferenceDelta(user, tagVec, delta);
    }

    @Transactional
    public void recordReadTime(AppUser user, Long channelId, Long postId, double seconds) {
        if (seconds < 1.0) return;
        double delta = Math.min(seconds / 20.0, 3.0);
        Map<String, Double> tagVec = resolveEngagementVector(channelId, postId);
        logEngagementEvent(
                user.getId(), channelId, postId, seconds, null,
                TelegramEngagementEvent.EventType.READ_TIME, tagVec);
        applyChannelPreferenceDelta(user, tagVec, delta);
    }

    private void applyChannelPreferenceDelta(AppUser user, Map<String, Double> channelVec, double delta) {
        if (channelVec.isEmpty()) return;

        UserTelegramContentPreference pref = contentPrefRepo.findByUser_Id(user.getId()).orElse(null);
        if (pref == null) {
            try {
                pref = new UserTelegramContentPreference(user);
                applyContentDelta(pref, channelVec, delta);
                contentPrefRepo.saveAndFlush(pref);
                return;
            } catch (DataIntegrityViolationException ex) {
                pref = contentPrefRepo.findByUser_Id(user.getId()).orElse(null);
                if (pref == null) return;
            }
        }
        applyContentDelta(pref, channelVec, delta);
        contentPrefRepo.save(pref);
    }

    private void logEngagementEvent(
            Long userId, Long channelId, Long postId, double value, Double feedScore,
            TelegramEngagementEvent.EventType eventType, Map<String, Double> tagVec) {
        try {
            TelegramEngagementEvent event = new TelegramEngagementEvent();
            event.setUserId(userId);
            event.setChannelId(channelId);
            event.setPostId(postId);
            event.setEventType(eventType);
            event.setValue(value);
            event.setFeedScore(feedScore);
            event.setTagSnapshot(TelegramEngagementTagResolver.toSnapshot(tagVec));
            engagementRepo.save(event);
        } catch (Exception ex) {
            // Analytics must not break feed personalization
            org.slf4j.LoggerFactory.getLogger(TelegramFeedService.class)
                    .warn("Failed to log Telegram engagement event: {}", ex.getMessage());
        }
    }

    private void applyContentDelta(
            UserTelegramContentPreference pref, Map<String, Double> channelVec, double delta) {
        Map<String, Double> userVec = TagVectorUtils.parseVector(pref.getContentTagVector());
        Map<String, Double> merged = new HashMap<>(userVec);
        for (var e : channelVec.entrySet()) {
            merged.merge(e.getKey().toLowerCase(), e.getValue() * delta, Double::sum);
        }
        pref.setContentTagVector(TagVectorUtils.toJson(TagVectorUtils.normalize(merged)));
    }

    /** @deprecated Use {@link #recordContentEngagement} */
    @Deprecated
    public void boostChannelPreference(AppUser user, Long channelId, double delta) {
        recordContentEngagement(user, channelId, delta);
    }

    @Deprecated
    public List<TelegramFeedPostDto> getPersonalizedFeed(AppUser user, String category, int limit, int page) {
        return getForYouFeed(user, limit, page, List.of());
    }

    private List<TelegramFeedPostDto> fetchPersonalizedPosts(
            Map<Long, Double> channelScores,
            Map<String, Double> telegramVec,
            Map<String, Double> siteVec,
            double telegramWeight,
            int limit,
            int page,
            List<Long> excludeIds,
            boolean diversifyChannels) {

        Set<Long> exclude = toExcludeSet(excludeIds);
        List<TelegramPost> candidates = collectCandidatePosts(exclude, limit, page);
        if (candidates.isEmpty()) return List.of();

        Map<Long, List<String>> tagsMap = loadTagsForPosts(candidates);
        double siteBlend = 1.0 - telegramWeight * (1.0 - MIN_SITE_BLEND);

        List<ScoredPost> scored = new ArrayList<>();
        for (TelegramPost p : candidates) {
            Long chId = p.getChannel().getId();
            double channelAff = channelScores.getOrDefault(chId, 0.05);
            double tagAff = scorePostTags(p.getId(), tagsMap, telegramVec, siteVec, telegramWeight, siteBlend);
            double recency = recencyScore(p.getMessageDate());
            double engagement = p.getViewCount() > 0
                    ? Math.log1p(p.getViewCount()) / 10.0 : 0.0;
            double exploration = Math.random() * 0.08;
            double total = 0.40 * channelAff + 0.25 * tagAff + 0.22 * recency + 0.10 * engagement + exploration;
            scored.add(new ScoredPost(p, total));
        }

        scored.sort(Comparator.comparingDouble(ScoredPost::score).reversed());

        List<ScoredPost> pageSlice = diversifyChannels
                ? pickTopWithSoftDiversity(scored, limit, MAX_POSTS_PER_CHANNEL_PER_PAGE)
                : scored.stream().limit(limit).toList();

        Map<Long, Double> scores = pageSlice.stream()
                .collect(Collectors.toMap(sp -> sp.post().getId(), ScoredPost::score, (a, b) -> a));
        return toDtos(pageSlice.stream().map(ScoredPost::post).toList(), scores);
    }

    /** Fetch one DB page of candidates for scoring — bounded work per feed page request. */
    private List<TelegramPost> collectCandidatePosts(Set<Long> exclude, int limit, int page) {
        var batch = postRepo.findActiveChannelPosts(
                PageRequest.of(page, limit * 2, Sort.by(Sort.Direction.DESC, "messageDate")));
        return batch.getContent().stream()
                .filter(p -> !exclude.contains(p.getId()))
                .toList();
    }

    private Map<String, Double> resolveEngagementVector(Long channelId, Long postId) {
        return TelegramEngagementTagResolver.resolve(profileRepo, postTagRepo, postRepo, channelId, postId);
    }

    private Map<Long, Double> buildBlendedChannelScores(
            List<TelegramChannel> activeChannels,
            Map<Long, Map<String, Double>> channelProfiles,
            Map<String, Double> telegramVec,
            Map<String, Double> siteVec,
            double telegramWeight) {

        double siteBlend = 1.0 - telegramWeight * (1.0 - MIN_SITE_BLEND);
        Map<Long, Double> channelScores = new HashMap<>();

        for (TelegramChannel ch : activeChannels) {
            Map<String, Double> chVec = channelProfiles.getOrDefault(ch.getId(), Map.of());
            double score;
            if (chVec.isEmpty()) {
                score = scoringService.computeCrawlPriority(ch) * 0.08;
            } else {
                double tgScore = telegramVec.isEmpty() ? 0.0 : TagVectorUtils.similarity(telegramVec, chVec);
                double siteScore = siteVec.isEmpty() ? 0.0 : TagVectorUtils.similarity(siteVec, chVec);
                score = telegramWeight * tgScore + siteBlend * siteScore;
                if (telegramVec.isEmpty() && siteVec.isEmpty()) {
                    score = scoringService.computeCrawlPriority(ch) * 0.08;
                } else {
                    score += 0.06;
                }
            }
            channelScores.put(ch.getId(), score);
        }
        return channelScores;
    }

    private double scorePostTags(
            Long postId,
            Map<Long, List<String>> tagsMap,
            Map<String, Double> telegramVec,
            Map<String, Double> siteVec,
            double telegramWeight,
            double siteBlend) {

        List<String> tags = tagsMap.getOrDefault(postId, List.of());
        if (tags.isEmpty()) return 0.0;

        double tgAff = 0.0;
        double siteAff = 0.0;
        for (String tag : tags) {
            String key = tag.toLowerCase();
            tgAff += telegramVec.getOrDefault(key, 0.0);
            siteAff += siteVec.getOrDefault(key, 0.0);
        }
        return telegramWeight * tgAff + siteBlend * siteAff;
    }

    private Map<Long, List<String>> loadTagsForPosts(List<TelegramPost> posts) {
        if (posts.isEmpty()) return Map.of();
        List<Long> ids = posts.stream().map(TelegramPost::getId).toList();
        return postTagRepo.findWithPostByPostIdIn(ids).stream()
                .collect(Collectors.groupingBy(
                        t -> t.getTelegramPost().getId(),
                        Collectors.mapping(TelegramPostTag::getTag, Collectors.toList())
                ));
    }

    private double computeTelegramBlendWeight(Map<String, Double> telegramVec, AppUser user) {
        double magnitude = telegramVec.values().stream().mapToDouble(Math::abs).sum();
        long engagementCount = engagementRepo.countByUserId(user.getId());
        double fromVec = Math.min(1.0, magnitude / 2.5);
        double fromEngagement = Math.min(1.0, engagementCount / 12.0);
        return Math.min(1.0, Math.max(fromVec, fromEngagement * 0.85));
    }

    private Map<String, Double> loadSitePreferenceVector(AppUser user) {
        Map<String, Double> vec = new HashMap<>();
        for (UserPreference pref : sitePrefRepo.findTop20ByAppUserIdOrderByWeightDesc(user.getId())) {
            if (pref.getWeight() > 0) {
                vec.put(pref.getTag().toLowerCase(), pref.getWeight());
            }
        }
        return vec.isEmpty() ? vec : TagVectorUtils.normalize(vec);
    }

    private Set<Long> toExcludeSet(List<Long> excludeIds) {
        if (excludeIds == null || excludeIds.isEmpty()) return Set.of();
        return new HashSet<>(excludeIds);
    }

    private List<ScoredPost> pickWithChannelDiversity(
            List<ScoredPost> scored, int offset, int limit, int maxPerChannel) {
        return pickTopWithSoftDiversity(scored.stream().skip(offset).toList(), limit, maxPerChannel);
    }

    /** Prefer channel diversity but always fill the page from remaining scored posts. */
    private List<ScoredPost> pickTopWithSoftDiversity(List<ScoredPost> scored, int limit, int maxPerChannel) {
        List<ScoredPost> result = new ArrayList<>();
        Map<Long, Integer> perChannel = new HashMap<>();
        Set<Long> usedPostIds = new HashSet<>();

        for (ScoredPost sp : scored) {
            if (result.size() >= limit) break;
            Long chId = sp.post().getChannel().getId();
            if (perChannel.getOrDefault(chId, 0) >= maxPerChannel) continue;
            result.add(sp);
            usedPostIds.add(sp.post().getId());
            perChannel.put(chId, perChannel.getOrDefault(chId, 0) + 1);
        }

        if (result.size() < limit) {
            for (ScoredPost sp : scored) {
                if (result.size() >= limit) break;
                if (usedPostIds.add(sp.post().getId())) {
                    result.add(sp);
                }
            }
        }
        return result;
    }

    private double scoreChannelForQuery(TelegramChannel ch, String q, Map<String, Double> queryVector) {
        double score = 0;

        Optional<ChannelPreferenceProfile> profileOpt = profileRepo.findByChannel_Id(ch.getId());
        if (profileOpt.isPresent()) {
            ChannelPreferenceProfile p = profileOpt.get();
            if (p.getAdminDescription() != null && p.getAdminDescription().toLowerCase().contains(q)) {
                score += 2.0;
            }
            if (p.getCategoryTreePath() != null && p.getCategoryTreePath().toLowerCase().contains(q)) {
                score += 1.5;
            }
            for (String word : q.split("\\s+")) {
                if (word.length() >= 2 && p.getCategoryTreePath() != null
                        && p.getCategoryTreePath().toLowerCase().contains(word)) {
                    score += 0.5;
                }
            }
            score += TagVectorUtils.similarity(
                    TagVectorUtils.parseVector(p.getFinalTagVector()), queryVector) * 3.0;
        }

        if (ch.getDisplayName() != null && ch.getDisplayName().toLowerCase().contains(q)) score += 0.8;
        if (ch.getDescription() != null && ch.getDescription().toLowerCase().contains(q)) score += 0.5;
        if (ch.getChannelUsername() != null && ch.getChannelUsername().toLowerCase().contains(q)) score += 0.8;

        return score;
    }

    private Map<String, Double> buildQueryVector(String query) {
        Map<String, Double> vec = new HashMap<>();
        for (String word : query.split("\\s+")) {
            if (word.length() >= 2) vec.put(word.toLowerCase(), 1.0);
        }
        return vec;
    }

    private Map<String, Double> loadUserContentVector(AppUser user) {
        return contentPrefRepo.findByUser_Id(user.getId())
                .map(p -> TagVectorUtils.parseVector(p.getContentTagVector()))
                .orElse(Map.of());
    }

    private Map<Long, Map<String, Double>> loadChannelProfileVectors(List<TelegramChannel> channels) {
        Map<Long, Map<String, Double>> map = new HashMap<>();
        for (TelegramChannel ch : channels) {
            profileRepo.findByChannel_Id(ch.getId()).ifPresent(p -> {
                Map<String, Double> vec = TagVectorUtils.parseVector(p.getFinalTagVector());
                if (!vec.isEmpty()) map.put(ch.getId(), vec);
            });
        }
        return map;
    }

    private double recencyScore(Instant messageDate) {
        if (messageDate == null) return 0.0;
        long hours = Duration.between(messageDate, Instant.now()).toHours();
        return Math.exp(-hours / 48.0);
    }

    private List<TelegramFeedPostDto> toDtos(List<TelegramPost> posts, Map<Long, Double> scores) {
        if (posts.isEmpty()) return List.of();
        List<Long> ids = posts.stream().map(TelegramPost::getId).toList();
        Map<Long, List<String>> tagsMap = postTagRepo.findWithPostByPostIdIn(ids).stream()
                .collect(Collectors.groupingBy(
                        t -> t.getTelegramPost().getId(),
                        Collectors.mapping(TelegramPostTag::getTag, Collectors.toList())
                ));
        return posts.stream().map(p -> {
            TelegramFeedPostDto dto = new TelegramFeedPostDto();
            dto.id = p.getId();
            dto.channelId = p.getChannel().getId();
            dto.channelUsername = p.getChannel().getChannelUsername();
            dto.channelDisplayName = p.getChannel().getDisplayName();
            dto.content = p.getContent();
            dto.mediaUrl = p.getMediaUrl();
            dto.mediaType = p.getMediaType();
            dto.messageDate = p.getMessageDate();
            dto.viewCount = (long) p.getViewCount();
            dto.edited = p.isEdited();
            dto.score = scores.get(p.getId());
            dto.tags = tagsMap.getOrDefault(p.getId(), List.of());
            profileRepo.findByChannel_Id(p.getChannel().getId())
                    .ifPresent(prof -> dto.channelDescription = prof.getAdminDescription());
            return dto;
        }).collect(Collectors.toList());
    }

    private TelegramChannelBrowseDto toBrowseDto(TelegramChannel ch) {
        TelegramChannelBrowseDto dto = new TelegramChannelBrowseDto();
        dto.id = ch.getId();
        dto.channelUsername = ch.getChannelUsername();
        dto.displayName = ch.getDisplayName();
        profileRepo.findByChannel_Id(ch.getId()).ifPresent(p -> {
            dto.adminDescription = truncate(p.getAdminDescription(), 160);
            dto.categoryPath = p.getCategoryTreePath();
        });
        if (dto.adminDescription == null) {
            dto.adminDescription = truncate(ch.getDescription(), 160);
        }
        return dto;
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }

    private record ScoredPost(TelegramPost post, double score) {}
}
