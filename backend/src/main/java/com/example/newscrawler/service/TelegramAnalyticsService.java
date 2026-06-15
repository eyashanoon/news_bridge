package com.example.newscrawler.service;

import com.example.newscrawler.dto.*;
import com.example.newscrawler.entity.TelegramChannel;
import com.example.newscrawler.repository.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class TelegramAnalyticsService {

    private final TelegramChannelRepository channelRepo;
    private final TelegramPostRepository postRepo;
    private final TelegramEngagementEventRepository engagementRepo;
    private final ChannelPreferenceProfileRepository profileRepo;
    private final TelegramScoreService scoreService;

    public TelegramAnalyticsService(TelegramChannelRepository channelRepo,
                                      TelegramPostRepository postRepo,
                                      TelegramEngagementEventRepository engagementRepo,
                                      ChannelPreferenceProfileRepository profileRepo,
                                      TelegramScoreService scoreService) {
        this.channelRepo = channelRepo;
        this.postRepo = postRepo;
        this.engagementRepo = engagementRepo;
        this.profileRepo = profileRepo;
        this.scoreService = scoreService;
    }

    public TelegramAnalyticsOverviewDto getOverview(int periodDays) {
        int days = Math.max(7, Math.min(periodDays, 90));
        Instant since = Instant.now().minus(days, ChronoUnit.DAYS);

        TelegramAnalyticsOverviewDto dto = new TelegramAnalyticsOverviewDto();
        dto.channelGrowth = buildChannelGrowth(since);
        dto.postsPerDay = buildPostsPerDay(since);
        dto.mostActiveChannels = mapChannelRanking(postRepo.topChannelsByPostsSince(since, PageRequest.of(0, 10)));
        dto.mostViewedChannels = mapChannelRankingFromViews(
                engagementRepo.topChannelsByViewsSince(since, PageRequest.of(0, 10)));
        dto.highestEngagementChannels = channelRepo.findAll().stream()
                .sorted((a, b) -> Double.compare(scoreService.engagementScore(b), scoreService.engagementScore(a)))
                .limit(10)
                .map(ch -> new LabelCountDto(label(ch), (long) (scoreService.engagementScore(ch) * 100)))
                .collect(Collectors.toList());
        dto.regionalDistribution = profileRepo.aggregateByScope().stream()
                .map(r -> new LabelCountDto(String.valueOf(r[0]), ((Number) r[1]).longValue()))
                .collect(Collectors.toList());
        dto.categoryDistribution = profileRepo.aggregateByCategory().stream()
                .map(r -> new LabelCountDto(String.valueOf(r[0]), ((Number) r[1]).longValue()))
                .collect(Collectors.toList());
        return dto;
    }

    private List<DailyActivityDto> buildChannelGrowth(Instant since) {
        List<TelegramChannel> channels = channelRepo.findAll().stream()
                .filter(c -> c.getCreatedAt() != null && !c.getCreatedAt().isBefore(since))
                .toList();
        Map<String, Long> byDay = channels.stream()
                .collect(Collectors.groupingBy(
                        c -> c.getCreatedAt().toString().substring(0, 10),
                        Collectors.counting()));
        return byDay.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(e -> {
                    DailyActivityDto d = new DailyActivityDto();
                    d.date = e.getKey();
                    d.count = e.getValue();
                    return d;
                })
                .collect(Collectors.toList());
    }

    private List<DailyActivityDto> buildPostsPerDay(Instant since) {
        List<DailyActivityDto> list = new ArrayList<>();
        for (Object[] row : postRepo.countPostsPerDaySince(since)) {
            DailyActivityDto d = new DailyActivityDto();
            d.date = String.valueOf(row[0]);
            d.count = ((Number) row[1]).longValue();
            list.add(d);
        }
        return list;
    }

    private List<LabelCountDto> mapChannelRanking(List<Object[]> rows) {
        Map<Long, TelegramChannel> lookup = channelRepo.findAll().stream()
                .collect(Collectors.toMap(TelegramChannel::getId, c -> c));
        return rows.stream().map(row -> {
            Long id = (Long) row[0];
            long count = ((Number) row[1]).longValue();
            TelegramChannel ch = lookup.get(id);
            return new LabelCountDto(ch != null ? label(ch) : "Channel " + id, count);
        }).collect(Collectors.toList());
    }

    private List<LabelCountDto> mapChannelRankingFromViews(List<Object[]> rows) {
        return mapChannelRanking(rows);
    }

    private static String label(TelegramChannel ch) {
        return ch.getDisplayName() != null ? ch.getDisplayName() : ch.getChannelUsername();
    }
}
