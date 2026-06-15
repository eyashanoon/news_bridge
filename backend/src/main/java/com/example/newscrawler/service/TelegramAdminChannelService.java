package com.example.newscrawler.service;

import com.example.newscrawler.dto.*;
import com.example.newscrawler.entity.*;
import com.example.newscrawler.repository.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class TelegramAdminChannelService {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final TelegramChannelRepository channelRepo;
    private final ChannelPreferenceProfileRepository profileRepo;
    private final ChannelTagRepository channelTagRepo;
    private final TelegramPostRepository postRepo;
    private final TelegramScoreService scoreService;
    private final TelegramProfileQualityService qualityService;
    private final TelegramCrawlLogRepository crawlLogRepo;
    private final TelegramEngagementEventRepository engagementRepo;
    private final ChannelProfileService profileService;

    public TelegramAdminChannelService(TelegramChannelRepository channelRepo,
                                       ChannelPreferenceProfileRepository profileRepo,
                                       ChannelTagRepository channelTagRepo,
                                       TelegramPostRepository postRepo,
                                       TelegramScoreService scoreService,
                                       TelegramProfileQualityService qualityService,
                                       TelegramCrawlLogRepository crawlLogRepo,
                                       TelegramEngagementEventRepository engagementRepo,
                                       ChannelProfileService profileService) {
        this.channelRepo = channelRepo;
        this.profileRepo = profileRepo;
        this.channelTagRepo = channelTagRepo;
        this.postRepo = postRepo;
        this.scoreService = scoreService;
        this.qualityService = qualityService;
        this.crawlLogRepo = crawlLogRepo;
        this.engagementRepo = engagementRepo;
        this.profileService = profileService;
    }

    public Page<TelegramChannelAdminDto> search(String q, String status, String scope, String language,
                                                String purpose, String country, String category, String tag,
                                                String sort, int page, int size) {
        RecordStatus statusEnum = parseStatus(status);
        List<TelegramChannel> all = channelRepo.findAll();

        Set<Long> tagChannelIds = null;
        if (tag != null && !tag.isBlank()) {
            tagChannelIds = new HashSet<>(channelTagRepo.findChannelIdsByTagLike(tag.trim()));
        }

        Set<Long> finalTagChannelIds = tagChannelIds;
        List<TelegramChannel> filtered = all.stream()
                .filter(ch -> statusEnum == null || ch.getStatus() == statusEnum)
                .filter(ch -> matchesQuery(ch, q))
                .filter(ch -> finalTagChannelIds == null || finalTagChannelIds.contains(ch.getId()))
                .filter(ch -> matchesProfileFilters(ch.getId(), scope, language, purpose, country, category))
                .sorted(buildComparator(sort))
                .toList();

        int from = Math.min(page * size, filtered.size());
        int to = Math.min(from + size, filtered.size());
        List<TelegramChannelAdminDto> content = filtered.subList(from, to).stream()
                .map(this::toAdminDto)
                .collect(Collectors.toList());

        return new PageImpl<>(content, PageRequest.of(page, size), filtered.size());
    }

    public TelegramChannelDetailDto getDetail(Long channelId) {
        TelegramChannel ch = channelRepo.findById(channelId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Channel not found"));
        ChannelPreferenceProfile profile = profileRepo.findByChannel_Id(channelId).orElse(null);

        TelegramChannelDetailDto dto = new TelegramChannelDetailDto();
        dto.channel = toAdminDto(ch);
        if (profile != null) {
            dto.adminDescription = profile.getAdminDescription();
            dto.categoryTreePath = profile.getCategoryTreePath();
            dto.onboardingAnswers = parseAnswers(profile.getOnboardingAnswers());
            dto.profileUpdatedAt = profile.getUpdatedAt();
            dto.profileQuality = qualityService.compute(ch, profile);
        }
        dto.tags = channelTagRepo.findByChannel_Id(channelId).stream()
                .sorted(Comparator.comparingDouble(ChannelTag::getWeight).reversed())
                .limit(30)
                .map(t -> {
                    TagWeightSummaryDto tw = new TagWeightSummaryDto();
                    tw.tag = t.getTag();
                    tw.averageWeight = t.getWeight();
                    tw.userCount = 1;
                    return tw;
                })
                .collect(Collectors.toList());
        return dto;
    }

    public TelegramChannelStatisticsDto getStatistics(Long channelId) {
        ensureChannel(channelId);
        Instant now = Instant.now();
        TelegramChannelStatisticsDto dto = new TelegramChannelStatisticsDto();
        dto.totalPosts = postRepo.countByChannel_Id(channelId);
        dto.dailyPosts = countPostsSince(channelId, now.minus(1, ChronoUnit.DAYS));
        dto.weeklyPosts = countPostsSince(channelId, now.minus(7, ChronoUnit.DAYS));
        dto.monthlyPosts = countPostsSince(channelId, now.minus(30, ChronoUnit.DAYS));
        return dto;
    }

    public TelegramChannelPerformanceDto getPerformance(Long channelId) {
        ensureChannel(channelId);
        TelegramChannel ch = channelRepo.findById(channelId).orElseThrow();
        TelegramChannelPerformanceDto dto = new TelegramChannelPerformanceDto();
        dto.successfulCrawlCount = crawlLogRepo.countSuccessfulByChannelId(channelId);
        dto.failedCrawlCount = crawlLogRepo.countFailedByChannelId(channelId);
        long total = dto.successfulCrawlCount + dto.failedCrawlCount;
        dto.crawlSuccessRate = total == 0 ? (ch.getTotalCrawls() > 0 ? 1.0 : 0.0)
                : (double) dto.successfulCrawlCount / total;
        dto.averageCrawlDurationMs = crawlLogRepo.avgDurationMsByChannelId(channelId);
        dto.averagePostsRetrieved = crawlLogRepo.avgPostsCreatedByChannelId(channelId);
        if (ch.getTotalCrawls() > 0 && ch.getCreatedAt() != null) {
            long days = Math.max(1, ChronoUnit.DAYS.between(ch.getCreatedAt(), Instant.now()));
            dto.crawlFrequencyPerDay = Math.round((ch.getTotalCrawls() * 100.0 / days)) / 100.0;
        }
        return dto;
    }

    public TelegramChannelUserInterestDto getUserInterest(Long channelId) {
        ensureChannel(channelId);
        TelegramChannelUserInterestDto dto = new TelegramChannelUserInterestDto();
        dto.interestedUserCount = engagementRepo.countDistinctUsersByChannelId(channelId);
        dto.userEngagementScore = scoreService.engagementScore(channelRepo.findById(channelId).orElseThrow());
        Double avgRead = engagementRepo.avgReadTimeByChannelId(channelId);
        dto.averageReadTimeSeconds = avgRead != null ? avgRead : 0.0;
        ChannelPreferenceProfile profile = profileRepo.findByChannel_Id(channelId).orElse(null);
        double prefScore = 0.0;
        if (profile != null) {
            if (profile.getFinalTagVector() != null && !profile.getFinalTagVector().isBlank()
                    && !"{}".equals(profile.getFinalTagVector().trim())) {
                prefScore = 1.0;
            } else if (profile.getPostTagVector() != null && !profile.getPostTagVector().isBlank()) {
                prefScore = 0.6;
            }
        }
        if (dto.interestedUserCount > 0) {
            prefScore = Math.max(prefScore, Math.min(1.0, dto.interestedUserCount / 10.0));
        }
        dto.preferenceScore = prefScore;
        return dto;
    }

    public void refreshProfile(Long channelId) {
        profileService.refreshPostTags(channelId);
    }

    public List<String> listDistinctCountries() {
        List<String> fromDb = profileRepo.findDistinctCountries();
        if (!fromDb.isEmpty()) {
            return fromDb;
        }
        return List.of(
                "Palestine", "Jordan", "Egypt", "Lebanon", "Syria", "Iraq",
                "Saudi Arabia", "UAE", "Kuwait", "Qatar", "Bahrain", "Oman",
                "Morocco", "Tunisia", "Algeria", "Libya", "Yemen"
        );
    }

    private long countPostsSince(Long channelId, Instant since) {
        return postRepo.findByChannel_Id(channelId, Pageable.unpaged()).stream()
                .filter(p -> {
                    Instant d = p.getMessageDate() != null ? p.getMessageDate() : p.getCollectedAt();
                    return d != null && !d.isBefore(since);
                })
                .count();
    }

    private TelegramChannelAdminDto toAdminDto(TelegramChannel ch) {
        ChannelPreferenceProfile profile = profileRepo.findByChannel_Id(ch.getId()).orElse(null);
        TelegramChannelAdminDto dto = new TelegramChannelAdminDto();
        dto.id = ch.getId();
        dto.channelUsername = ch.getChannelUsername();
        dto.displayName = ch.getDisplayName();
        dto.description = ch.getDescription();
        dto.avatarUrl = ch.getAvatarUrl();
        dto.status = ch.getStatus().name();
        dto.language = ch.getLanguage();
        dto.subscriberCount = ch.getSubscriberCount();
        dto.totalPostsCollected = ch.getTotalPostsCollected();
        dto.lastCrawledAt = ch.getLastCrawledAt();
        dto.crawlScore = ch.getCrawlScore();
        dto.totalCrawls = ch.getTotalCrawls();
        dto.postFrequency = ch.getPostFrequency();
        dto.avgViewCount = ch.getAvgViewCount();
        dto.onboardingCompleted = ch.isOnboardingCompleted();
        dto.crawlPriority = scoreService.crawlPriority(ch);
        dto.waitlist = scoreService.waitlist(ch);
        dto.engagementScore = scoreService.engagementScore(ch);
        dto.healthScore = scoreService.healthScore(ch, profile);
        dto.createdAt = ch.getCreatedAt();
        if (profile != null) {
            dto.region = profile.getScope();
            dto.purpose = profile.getPurpose();
            dto.country = profile.getCountry();
            dto.category = profile.getCategory();
            if (dto.language == null) dto.language = inferLanguage(profile);
        }
        dto.mainTags = channelTagRepo.findByChannel_Id(ch.getId()).stream()
                .sorted(Comparator.comparingDouble(ChannelTag::getWeight).reversed())
                .limit(5)
                .map(t -> {
                    TagWeightSummaryDto tw = new TagWeightSummaryDto();
                    tw.tag = t.getTag();
                    tw.averageWeight = t.getWeight();
                    tw.userCount = 1;
                    return tw;
                })
                .collect(Collectors.toList());
        return dto;
    }

    private boolean matchesQuery(TelegramChannel ch, String q) {
        if (q == null || q.isBlank()) return true;
        String lower = q.toLowerCase().trim();
        if (String.valueOf(ch.getId()).contains(lower)) return true;
        if (ch.getChannelUsername() != null && ch.getChannelUsername().toLowerCase().contains(lower)) return true;
        if (ch.getDisplayName() != null && ch.getDisplayName().toLowerCase().contains(lower)) return true;
        return ch.getDescription() != null && ch.getDescription().toLowerCase().contains(lower);
    }

    private boolean matchesProfileFilters(Long channelId, String scope, String language,
                                          String purpose, String country, String category) {
        Optional<ChannelPreferenceProfile> profile = profileRepo.findByChannel_Id(channelId);
        if (scope != null && !scope.isBlank()) {
            if (profile.isEmpty() || profile.get().getScope() == null
                    || !profile.get().getScope().equalsIgnoreCase(scope.trim())) return false;
        }
        if (purpose != null && !purpose.isBlank()) {
            if (profile.isEmpty() || profile.get().getPurpose() == null
                    || !profile.get().getPurpose().equalsIgnoreCase(purpose.trim())) return false;
        }
        if (country != null && !country.isBlank()) {
            if (profile.isEmpty() || profile.get().getCountry() == null
                    || !profile.get().getCountry().equalsIgnoreCase(country.trim())) return false;
        }
        if (language != null && !language.isBlank()) {
            TelegramChannel ch = channelRepo.findById(channelId).orElse(null);
            String lang = ch != null ? ch.getLanguage() : null;
            if (lang == null && profile.isPresent()) lang = inferLanguage(profile.get());
            if (lang == null || !lang.toLowerCase().contains(language.trim().toLowerCase())) return false;
        }
        return true;
    }

    private Comparator<TelegramChannel> buildComparator(String sort) {
        if (sort == null) sort = "newest";
        return switch (sort.toLowerCase()) {
            case "most_active" -> Comparator.comparingDouble(TelegramChannel::getPostFrequency).reversed();
            case "engagement" -> Comparator.comparingDouble((TelegramChannel ch) -> scoreService.engagementScore(ch)).reversed();
            case "priority" -> Comparator.comparingDouble((TelegramChannel ch) -> scoreService.crawlPriority(ch)).reversed();
            case "most_posts" -> Comparator.comparingInt(TelegramChannel::getTotalPostsCollected).reversed();
            default -> Comparator.comparing(TelegramChannel::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder()));
        };
    }

    private RecordStatus parseStatus(String status) {
        if (status == null || status.isBlank()) return null;
        if ("inactive".equalsIgnoreCase(status) || "suspended".equalsIgnoreCase(status)) {
            return RecordStatus.SUSPENDED;
        }
        if ("active".equalsIgnoreCase(status)) return RecordStatus.ACTIVE;
        try {
            return RecordStatus.valueOf(status.toUpperCase());
        } catch (Exception e) {
            return null;
        }
    }

    private void ensureChannel(Long id) {
        if (!channelRepo.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Channel not found");
        }
    }

    private Map<String, String> parseAnswers(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return MAPPER.readValue(json, new TypeReference<>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    private String inferLanguage(ChannelPreferenceProfile profile) {
        if (profile.getCountry() != null) {
            String c = profile.getCountry().toLowerCase();
            if (c.contains("palestine") || c.contains("jordan") || c.contains("egypt") || c.contains("arab")) {
                return "ar";
            }
        }
        return "en";
    }
}
