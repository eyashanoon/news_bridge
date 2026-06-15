package com.example.newscrawler.service;

import com.example.newscrawler.dto.ChannelAffinitySummaryDto;
import com.example.newscrawler.dto.DailyActivityDto;
import com.example.newscrawler.dto.PreferenceClusterDto;
import com.example.newscrawler.dto.TagWeightSummaryDto;
import com.example.newscrawler.dto.UserBehaviorProfileResponse;
import com.example.newscrawler.dto.UserEngagementSummaryDto;
import com.example.newscrawler.dto.UserInteractionsAnalyticsResponse;
import com.example.newscrawler.dto.UserPreferencesAnalyticsResponse;
import com.example.newscrawler.entity.EditorUser;
import com.example.newscrawler.entity.ReactionType;
import com.example.newscrawler.entity.RegisteredUser;
import com.example.newscrawler.entity.UserChannelPreference;
import com.example.newscrawler.entity.UserPreference;
import com.example.newscrawler.repository.EditorUserRepository;
import com.example.newscrawler.repository.LoginDeviceRepository;
import com.example.newscrawler.repository.PostInteractionRepository;
import com.example.newscrawler.repository.PostReactionRepository;
import com.example.newscrawler.repository.RegisteredUserRepository;
import com.example.newscrawler.repository.TelegramEngagementEventRepository;
import com.example.newscrawler.repository.UserChannelPreferenceRepository;
import com.example.newscrawler.repository.UserPreferenceRepository;
import com.example.newscrawler.repository.UserTelegramContentPreferenceRepository;
import com.example.newscrawler.util.TagVectorUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class UserIntelligenceService {

    @Autowired
    private UserPreferenceRepository preferenceRepository;

    @Autowired
    private UserChannelPreferenceRepository channelPreferenceRepository;

    @Autowired
    private PostInteractionRepository interactionRepository;

    @Autowired
    private PostReactionRepository reactionRepository;

    @Autowired
    private RegisteredUserRepository registeredUserRepository;

    @Autowired
    private EditorUserRepository editorUserRepository;

    @Autowired
    private LoginDeviceRepository loginDeviceRepository;

    @Autowired
    private UserActivityMetricsService activityMetricsService;

    @Autowired
    private UserTelegramContentPreferenceRepository telegramContentPrefRepo;

    @Autowired
    private TelegramEngagementEventRepository telegramEngagementRepo;

    public UserPreferencesAnalyticsResponse getPreferencesAnalytics() {
        long registeredCount = registeredUserRepository.findAll().stream()
                .filter(u -> !(u instanceof EditorUser))
                .count();
        long editorCount = editorUserRepository.count();

        UserPreferencesAnalyticsResponse response = new UserPreferencesAnalyticsResponse();
        response.totalFrontendUsers = registeredCount + editorCount;
        response.registeredUserCount = registeredCount;
        response.editorUserCount = editorCount;
        response.usersWithPreferences = preferenceRepository.countDistinctUsers();
        response.usersWithChannelPreferences = channelPreferenceRepository.countDistinctUsers()
                + telegramContentPrefRepo.count();
        response.topTags = mergeTopTags(
                mapTagRows(preferenceRepository.aggregateTopTags(), 20),
                aggregateTelegramContentTags(),
                20);
        response.topCategories = response.topTags;
        response.topChannels = mapChannelRows(channelPreferenceRepository.aggregateTopChannels(), 15);
        response.preferenceClusters = buildClusters();
        return response;
    }

    public UserInteractionsAnalyticsResponse getInteractionsAnalytics(int periodDays) {
        int days = Math.max(1, Math.min(periodDays, 90));
        LocalDateTime since = LocalDateTime.now().minusDays(days);

        long registeredCount = registeredUserRepository.findAll().stream()
                .filter(u -> !(u instanceof EditorUser))
                .count();
        long editorCount = editorUserRepository.count();

        UserInteractionsAnalyticsResponse response = new UserInteractionsAnalyticsResponse();
        response.periodDays = days;
        response.totalFrontendUsers = registeredCount + editorCount;
        response.activeUsersInPeriod = interactionRepository.countDistinctActiveUsersSince(since);
        response.interactionsPerDay = interactionRepository.countInteractionsPerDaySince(since).stream()
                .map(row -> {
                    DailyActivityDto dto = new DailyActivityDto();
                    dto.date = String.valueOf(row[0]);
                    dto.count = ((Number) row[1]).longValue();
                    return dto;
                })
                .collect(Collectors.toList());

        List<Object[]> totals = interactionRepository.aggregateTotals();
        if (!totals.isEmpty()) {
            Object[] t = totals.get(0);
            response.totalViews = ((Number) t[0]).longValue();
            response.totalClicks = ((Number) t[1]).longValue();
            response.totalTimeSpent = ((Number) t[2]).doubleValue();
        }

        Map<ReactionType, Long> reactionCounts = new HashMap<>();
        for (Object[] row : reactionRepository.aggregateByReactionType()) {
            reactionCounts.put((ReactionType) row[0], ((Number) row[1]).longValue());
        }
        response.totalLikes = reactionCounts.getOrDefault(ReactionType.LIKE, 0L);
        response.totalDislikes = reactionCounts.getOrDefault(ReactionType.DISLIKE, 0L);

        Map<Long, long[]> reactionsByUser = new HashMap<>();
        for (Object[] row : reactionRepository.aggregateByUserAndType()) {
            Long userId = (Long) row[0];
            ReactionType type = (ReactionType) row[1];
            long count = ((Number) row[2]).longValue();
            long[] arr = reactionsByUser.computeIfAbsent(userId, id -> new long[2]);
            if (type == ReactionType.LIKE) arr[0] = count;
            else arr[1] = count;
        }

        Map<Long, RegisteredUser> userLookup = buildUserLookup();
        response.topEngagedUsers = interactionRepository.topEngagedUsers().stream()
                .limit(10)
                .map(row -> {
                    Long userId = (Long) row[0];
                    UserEngagementSummaryDto dto = new UserEngagementSummaryDto();
                    dto.userId = userId;
                    RegisteredUser user = userLookup.get(userId);
                    if (user != null) {
                        dto.email = user.getEmail();
                        dto.username = user.getUsername();
                    }
                    dto.views = ((Number) row[1]).longValue();
                    dto.clicks = ((Number) row[2]).longValue();
                    dto.timeSpent = ((Number) row[3]).doubleValue();
                    long[] reactions = reactionsByUser.getOrDefault(userId, new long[2]);
                    dto.likes = reactions[0];
                    dto.dislikes = reactions[1];
                    dto.engagementScore = dto.views + dto.clicks * 3.0 + dto.timeSpent * 0.1 + dto.likes * 2.0;
                    return dto;
                })
                .collect(Collectors.toList());
        return response;
    }

    public UserBehaviorProfileResponse getBehaviorProfile(Long userId, int periodDays) {
        RegisteredUser user = resolveFrontendUser(userId);
        int days = Math.max(1, Math.min(periodDays, 90));
        LocalDateTime since = LocalDateTime.now().minusDays(days);

        var metrics = activityMetricsService.getMetrics(userId);
        UserBehaviorProfileResponse profile = new UserBehaviorProfileResponse();
        profile.userId = userId;
        profile.email = user.getEmail();
        profile.username = user.getUsername();
        profile.fullName = user.getFullName();
        profile.userType = user instanceof EditorUser ? "EDITOR"
                : (user.getType() != null ? user.getType().name() : "REGISTERED");
        profile.status = user.getStatus() != null ? user.getStatus().name() : null;
        profile.registeredAt = user.getCreatedAt();
        profile.lastActivityAt = metrics.lastActivityAt;
        profile.lastLoginAt = loginDeviceRepository.findLastSeenByUserId(userId).orElse(null);
        profile.overallEngagementScore = metrics.activityScore;
        profile.activityLevel = metrics.activityLevel;
        profile.periodDays = days;
        profile.loginDeviceCount = loginDeviceRepository.countByUserId(userId);
        profile.preferenceTagCount = preferenceRepository.countByAppUserId(userId);
        profile.channelAffinityCount = channelPreferenceRepository.countByUser_Id(userId);

        applyLifetimeEngagement(profile, userId);
        applyPeriodEngagement(profile, userId, since);

        profile.activityPerDay = interactionRepository.countInteractionsPerDayForUserSince(userId, since).stream()
                .map(row -> {
                    DailyActivityDto dto = new DailyActivityDto();
                    dto.date = String.valueOf(row[0]);
                    dto.count = ((Number) row[1]).longValue();
                    return dto;
                })
                .collect(Collectors.toList());

        List<TagWeightSummaryDto> articleTags = preferenceRepository.findTop20ByAppUserIdOrderByWeightDesc(userId).stream()
                .map(this::toTagDto)
                .collect(Collectors.toList());
        List<TagWeightSummaryDto> telegramTags = telegramContentPrefRepo.findByUser_Id(userId)
                .map(pref -> TagVectorUtils.parseVector(pref.getContentTagVector()).entrySet().stream()
                        .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                        .limit(15)
                        .map(e -> {
                            TagWeightSummaryDto dto = new TagWeightSummaryDto();
                            dto.tag = e.getKey();
                            dto.averageWeight = e.getValue();
                            dto.userCount = 1;
                            return dto;
                        })
                        .collect(Collectors.toList()))
                .orElse(List.of());
        profile.interestScores = mergeTopTags(articleTags, telegramTags, 25);

        profile.channelAffinities = channelPreferenceRepository.findTop10ByUser_IdOrderByWeightDesc(userId).stream()
                .map(this::toChannelDto)
                .collect(Collectors.toList());

        long telegramEngagements = telegramEngagementRepo.countByUserId(userId);

        Map<String, Double> contentPrefs = new LinkedHashMap<>();
        contentPrefs.put("article_views", (double) profile.lifetimeViews);
        contentPrefs.put("article_clicks", (double) profile.lifetimeClicks);
        contentPrefs.put("time_spent_seconds", profile.lifetimeTimeSpent);
        contentPrefs.put("likes", (double) profile.lifetimeLikes);
        contentPrefs.put("dislikes", (double) profile.lifetimeDislikes);
        contentPrefs.put("telegram_channel_affinities", (double) profile.channelAffinityCount);
        contentPrefs.put("telegram_content_signals", (double) telegramTags.size());
        contentPrefs.put("telegram_engagements", (double) telegramEngagements);
        contentPrefs.put("interest_tags", (double) profile.preferenceTagCount);
        profile.contentTypePreference = contentPrefs;
        return profile;
    }

    private List<TagWeightSummaryDto> aggregateTelegramContentTags() {
        Map<String, Double> merged = new HashMap<>();
        for (var pref : telegramContentPrefRepo.findAll()) {
            for (var e : TagVectorUtils.parseVector(pref.getContentTagVector()).entrySet()) {
                merged.merge(e.getKey().toLowerCase(), e.getValue(), Double::sum);
            }
        }
        return merged.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .limit(20)
                .map(e -> {
                    TagWeightSummaryDto dto = new TagWeightSummaryDto();
                    dto.tag = e.getKey();
                    dto.averageWeight = e.getValue();
                    dto.userCount = 1;
                    return dto;
                })
                .collect(Collectors.toList());
    }

    private List<TagWeightSummaryDto> mergeTopTags(
            List<TagWeightSummaryDto> primary,
            List<TagWeightSummaryDto> secondary,
            int limit) {
        Map<String, TagWeightSummaryDto> merged = new LinkedHashMap<>();
        for (TagWeightSummaryDto dto : primary) {
            merged.put(dto.tag.toLowerCase(), dto);
        }
        for (TagWeightSummaryDto dto : secondary) {
            merged.merge(dto.tag.toLowerCase(), dto, (a, b) -> {
                a.averageWeight = Math.max(a.averageWeight, b.averageWeight);
                a.userCount = Math.max(a.userCount, b.userCount);
                return a;
            });
        }
        return merged.values().stream()
                .sorted((a, b) -> Double.compare(b.averageWeight, a.averageWeight))
                .limit(limit)
                .collect(Collectors.toList());
    }

    private RegisteredUser resolveFrontendUser(Long userId) {
        EditorUser editor = editorUserRepository.findById(userId).orElse(null);
        if (editor != null) {
            return editor;
        }
        RegisteredUser registered = registeredUserRepository.findById(userId).orElse(null);
        if (registered != null && !(registered instanceof EditorUser)) {
            return registered;
        }
        throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Frontend user not found");
    }

    private void applyLifetimeEngagement(UserBehaviorProfileResponse profile, Long userId) {
        List<Object[]> rows = interactionRepository.aggregateEngagementForUser(userId);
        if (!rows.isEmpty()) {
            Object[] row = rows.get(0);
            profile.lifetimeViews = ((Number) row[0]).longValue();
            profile.lifetimeClicks = ((Number) row[1]).longValue();
            profile.lifetimeTimeSpent = ((Number) row[2]).doubleValue();
        }

        for (Object[] row : reactionRepository.aggregateByUserAndTypeForUser(userId)) {
            ReactionType type = (ReactionType) row[0];
            long count = ((Number) row[1]).longValue();
            if (type == ReactionType.LIKE) profile.lifetimeLikes = count;
            else if (type == ReactionType.DISLIKE) profile.lifetimeDislikes = count;
        }
    }

    private void applyPeriodEngagement(UserBehaviorProfileResponse profile, Long userId, LocalDateTime since) {
        List<Object[]> rows = interactionRepository.aggregateEngagementForUserSince(userId, since);
        if (!rows.isEmpty()) {
            Object[] row = rows.get(0);
            profile.periodViews = ((Number) row[0]).longValue();
            profile.periodClicks = ((Number) row[1]).longValue();
            profile.periodTimeSpent = ((Number) row[2]).doubleValue();
            profile.periodInteractions = ((Number) row[3]).longValue();
        }
    }

    private List<PreferenceClusterDto> buildClusters() {
        Map<String, List<Long>> segmentUsers = new HashMap<>();
        Map<Long, List<Object[]>> preferencesByUser = new HashMap<>();
        Map<Long, Double> scores = activityMetricsService.getAllMetrics().entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey, e -> e.getValue().activityScore));

        for (Object[] row : preferenceRepository.findAllWeightedPreferences()) {
            Long userId = (Long) row[0];
            double weight = ((Number) row[2]).doubleValue();
            String segment = weight >= 5 ? "high_engagement" : weight >= 2 ? "moderate" : "casual";
            segmentUsers.computeIfAbsent(segment, k -> new ArrayList<>()).add(userId);
            preferencesByUser.computeIfAbsent(userId, k -> new ArrayList<>()).add(row);
        }

        if (segmentUsers.isEmpty()) {
            segmentUsers.put("new_users", new ArrayList<>());
        }

        List<PreferenceClusterDto> clusters = new ArrayList<>();
        for (Map.Entry<String, List<Long>> entry : segmentUsers.entrySet()) {
            List<Long> userIds = entry.getValue().stream().distinct().collect(Collectors.toList());
            PreferenceClusterDto cluster = new PreferenceClusterDto();
            cluster.segment = entry.getKey();
            cluster.userCount = userIds.size();
            Map<String, Double> segmentTagWeights = new HashMap<>();
            for (Long userId : userIds) {
                for (Object[] pref : preferencesByUser.getOrDefault(userId, List.of())) {
                    String tag = (String) pref[1];
                    double weight = ((Number) pref[2]).doubleValue();
                    segmentTagWeights.merge(tag, weight, Double::sum);
                }
            }
            cluster.topInterests = segmentTagWeights.entrySet().stream()
                    .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                    .limit(5)
                    .map(Map.Entry::getKey)
                    .collect(Collectors.toList());
            double avg = userIds.stream()
                    .mapToDouble(id -> scores.getOrDefault(id, 0.0))
                    .average()
                    .orElse(0);
            cluster.averageActivityScore = avg;
            clusters.add(cluster);
        }
        return clusters;
    }

    private Map<Long, RegisteredUser> buildUserLookup() {
        Map<Long, RegisteredUser> map = new HashMap<>();
        registeredUserRepository.findAll().forEach(u -> map.put(u.getId(), u));
        editorUserRepository.findAll().forEach(u -> map.put(u.getId(), u));
        return map;
    }

    private List<TagWeightSummaryDto> mapTagRows(List<Object[]> rows, int limit) {
        return rows.stream().limit(limit).map(row -> {
            TagWeightSummaryDto dto = new TagWeightSummaryDto();
            dto.tag = (String) row[0];
            dto.averageWeight = ((Number) row[1]).doubleValue();
            dto.userCount = ((Number) row[2]).longValue();
            return dto;
        }).collect(Collectors.toList());
    }

    private List<ChannelAffinitySummaryDto> mapChannelRows(List<Object[]> rows, int limit) {
        return rows.stream().limit(limit).map(row -> {
            ChannelAffinitySummaryDto dto = new ChannelAffinitySummaryDto();
            dto.channelId = (Long) row[0];
            dto.channelName = row[1] != null ? (String) row[1] : (String) row[2];
            dto.channelUsername = (String) row[2];
            dto.totalWeight = ((Number) row[3]).doubleValue();
            dto.followerCount = ((Number) row[4]).longValue();
            return dto;
        }).collect(Collectors.toList());
    }

    private TagWeightSummaryDto toTagDto(UserPreference pref) {
        TagWeightSummaryDto dto = new TagWeightSummaryDto();
        dto.tag = pref.getTag();
        dto.averageWeight = pref.getWeight();
        dto.userCount = 1;
        return dto;
    }

    private ChannelAffinitySummaryDto toChannelDto(UserChannelPreference pref) {
        ChannelAffinitySummaryDto dto = new ChannelAffinitySummaryDto();
        dto.channelId = pref.getChannel().getId();
        dto.channelName = pref.getChannel().getDisplayName() != null
                ? pref.getChannel().getDisplayName()
                : pref.getChannel().getChannelUsername();
        dto.channelUsername = pref.getChannel().getChannelUsername();
        dto.totalWeight = pref.getWeight();
        dto.followerCount = 1;
        return dto;
    }
}
