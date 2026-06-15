package com.example.newscrawler.service;

import com.example.newscrawler.dto.LabelCountDto;
import com.example.newscrawler.dto.TelegramUserAnalyticsOverviewDto;
import com.example.newscrawler.entity.TelegramEngagementEvent;
import com.example.newscrawler.entity.UserTelegramContentPreference;
import com.example.newscrawler.repository.ChannelPreferenceProfileRepository;
import com.example.newscrawler.repository.TelegramEngagementEventRepository;
import com.example.newscrawler.repository.TelegramPostRepository;
import com.example.newscrawler.repository.TelegramPostTagRepository;
import com.example.newscrawler.repository.UserTelegramContentPreferenceRepository;
import com.example.newscrawler.util.TagVectorUtils;
import com.example.newscrawler.util.TelegramEngagementTagResolver;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class TelegramUserAnalyticsService {

    private final UserTelegramContentPreferenceRepository prefRepo;
    private final TelegramEngagementEventRepository engagementRepo;
    private final ChannelPreferenceProfileRepository profileRepo;
    private final TelegramPostTagRepository postTagRepo;
    private final TelegramPostRepository postRepo;

    public TelegramUserAnalyticsService(
            UserTelegramContentPreferenceRepository prefRepo,
            TelegramEngagementEventRepository engagementRepo,
            ChannelPreferenceProfileRepository profileRepo,
            TelegramPostTagRepository postTagRepo,
            TelegramPostRepository postRepo) {
        this.prefRepo = prefRepo;
        this.engagementRepo = engagementRepo;
        this.profileRepo = profileRepo;
        this.postTagRepo = postTagRepo;
        this.postRepo = postRepo;
    }

    @Transactional(readOnly = true)
    public TelegramUserAnalyticsOverviewDto getOverview() {
        Instant now = Instant.now();
        Instant last30 = now.minus(30, ChronoUnit.DAYS);
        Instant last90 = now.minus(90, ChronoUnit.DAYS);
        Instant prior30 = now.minus(60, ChronoUnit.DAYS);

        Map<String, Double> aggregated = new HashMap<>();

        for (UserTelegramContentPreference pref : prefRepo.findAll()) {
            mergeVector(aggregated, TagVectorUtils.parseVector(pref.getContentTagVector()), 1.0);
        }

        for (TelegramEngagementEvent event : engagementRepo.findByCreatedAtAfter(last90)) {
            double weight = eventWeight(event);
            if (weight <= 0) continue;
            mergeVector(aggregated, resolveEventVector(event), weight);
        }

        if (aggregated.isEmpty()) {
            for (Object[] row : postTagRepo.findPopularTags(PageRequest.of(0, 20))) {
                if (row[0] != null) {
                    aggregated.put(String.valueOf(row[0]).toLowerCase(), ((Number) row[1]).doubleValue());
                }
            }
        }

        TelegramUserAnalyticsOverviewDto dto = new TelegramUserAnalyticsOverviewDto();
        dto.generatedAt = now;
        dto.usersWithPreferences = prefRepo.countWithLearnedPreferences();
        dto.activeUsersLast30Days = engagementRepo.countDistinctUsersSince(last30);
        dto.totalEngagementEvents = engagementRepo.count();
        dto.viewsLast30Days = engagementRepo.countByEventTypeAndCreatedAtAfter(
                TelegramEngagementEvent.EventType.VIEW, last30);
        dto.readTimeEventsLast30Days = engagementRepo.countByEventTypeAndCreatedAtAfter(
                TelegramEngagementEvent.EventType.READ_TIME, last30);

        dto.topTags = topN(aggregated, 12);
        dto.topTopics = dto.topTags.stream().limit(8).collect(Collectors.toList());
        dto.topCategories = firstNonEmpty(
                filterPrefix(aggregated, "news", "sports", "tech", "finance", "entertainment", "politics", "culture"),
                dto.topTags.stream().limit(8).collect(Collectors.toList()));
        dto.topRegions = firstNonEmpty(
                filterPrefix(aggregated, "region:", "country:", "city:"),
                List.of());
        dto.topContentTypes = firstNonEmpty(
                filterContains(aggregated, "news", "sports", "tech", "video", "photo"),
                dto.topTags.stream().limit(6).collect(Collectors.toList()));

        Map<String, Double> recent = aggregateEventsBetween(last30, now);
        Map<String, Double> prior = aggregateEventsBetween(prior30, last30);
        dto.fastestGrowingInterests = fastestGrowing(prior, recent, 5);
        if (dto.fastestGrowingInterests.isEmpty()) {
            dto.fastestGrowingInterests = topN(recent, 5);
        }
        if (dto.fastestGrowingInterests.isEmpty()) {
            dto.fastestGrowingInterests = dto.topTags.stream().limit(5).collect(Collectors.toList());
        }

        dto.decliningInterests = declining(prior, recent, 5);
        if (dto.decliningInterests.isEmpty()) {
            dto.decliningInterests = dto.topTags.stream()
                    .sorted(Comparator.comparingDouble(l -> l.value))
                    .limit(5)
                    .collect(Collectors.toList());
        }

        return dto;
    }

    private List<LabelCountDto> firstNonEmpty(List<LabelCountDto> primary, List<LabelCountDto> fallback) {
        return primary.isEmpty() ? fallback : primary;
    }

    private Map<String, Double> aggregateEventsBetween(Instant start, Instant end) {
        Map<String, Double> map = new HashMap<>();
        for (TelegramEngagementEvent event : engagementRepo.findByCreatedAtBetween(start, end)) {
            mergeVector(map, resolveEventVector(event), eventWeight(event));
        }
        return map;
    }

    private List<LabelCountDto> fastestGrowing(Map<String, Double> prior, Map<String, Double> recent, int n) {
        Map<String, Double> growth = new HashMap<>();
        for (var e : recent.entrySet()) {
            double delta = e.getValue() - prior.getOrDefault(e.getKey(), 0.0);
            if (delta > 0) growth.put(e.getKey(), delta);
        }
        return topN(growth, n);
    }

    private List<LabelCountDto> declining(Map<String, Double> prior, Map<String, Double> recent, int n) {
        Map<String, Double> decline = new HashMap<>();
        for (var e : prior.entrySet()) {
            double delta = e.getValue() - recent.getOrDefault(e.getKey(), 0.0);
            if (delta > 0) decline.put(e.getKey(), delta);
        }
        return topN(decline, n);
    }

    private void mergeVector(Map<String, Double> target, Map<String, Double> source, double weight) {
        for (var e : source.entrySet()) {
            target.merge(e.getKey().toLowerCase(), e.getValue() * weight, Double::sum);
        }
    }

    private double eventWeight(TelegramEngagementEvent event) {
        if (event.getEventType() == TelegramEngagementEvent.EventType.READ_TIME) {
            return Math.min(event.getValue() / 15.0, 3.0);
        }
        return Math.max(event.getValue(), 0.1);
    }

    private Map<String, Double> resolveEventVector(TelegramEngagementEvent event) {
        Map<String, Double> snapshot = TelegramEngagementTagResolver.parseSnapshot(event.getTagSnapshot());
        if (!snapshot.isEmpty()) return snapshot;

        return TelegramEngagementTagResolver.resolve(
                profileRepo, postTagRepo, postRepo, event.getChannelId(), event.getPostId());
    }

    private List<LabelCountDto> topN(Map<String, Double> map, int n) {
        if (map.isEmpty()) return List.of();
        return map.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .limit(n)
                .map(e -> new LabelCountDto(e.getKey(), Math.round(e.getValue() * 10) / 10.0))
                .collect(Collectors.toList());
    }

    private List<LabelCountDto> filterPrefix(Map<String, Double> map, String... prefixes) {
        return map.entrySet().stream()
                .filter(e -> Arrays.stream(prefixes).anyMatch(p ->
                        e.getKey().startsWith(p) || e.getKey().contains(p)))
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .limit(10)
                .map(e -> new LabelCountDto(e.getKey(), Math.round(e.getValue() * 10) / 10.0))
                .collect(Collectors.toList());
    }

    private List<LabelCountDto> filterContains(Map<String, Double> map, String... tokens) {
        return map.entrySet().stream()
                .filter(e -> Arrays.stream(tokens).anyMatch(t -> e.getKey().contains(t)))
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .limit(10)
                .map(e -> new LabelCountDto(e.getKey(), Math.round(e.getValue() * 10) / 10.0))
                .collect(Collectors.toList());
    }
}
