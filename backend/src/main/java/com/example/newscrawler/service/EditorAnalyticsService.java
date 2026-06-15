package com.example.newscrawler.service;

import com.example.newscrawler.dto.DailyActivityDto;
import com.example.newscrawler.dto.EditorAnalyticsResponse;
import com.example.newscrawler.dto.EditorPerformanceDto;
import com.example.newscrawler.entity.EditorUser;
import com.example.newscrawler.entity.UserStatus;
import com.example.newscrawler.repository.EditorRequestRepository;
import com.example.newscrawler.repository.EditorUserRepository;
import com.example.newscrawler.repository.LiveNewsPostRepository;
import com.example.newscrawler.repository.TopicPostRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class EditorAnalyticsService {

    @Autowired
    private EditorUserRepository editorUserRepository;

    @Autowired
    private EditorRequestRepository editorRequestRepository;

    @Autowired
    private LiveNewsPostRepository liveNewsPostRepository;

    @Autowired
    private TopicPostRepository topicPostRepository;

    @Autowired
    private UserActivityMetricsService activityMetricsService;

    public EditorAnalyticsResponse getAnalytics(int periodDays) {
        int days = Math.max(1, Math.min(periodDays, 90));
        Instant since = Instant.now().minusSeconds((long) days * 24 * 3600);
        List<EditorUser> editors = editorUserRepository.findAll();
        Map<Long, long[]> contributions = loadContributions(editors);

        EditorAnalyticsResponse response = new EditorAnalyticsResponse();
        response.periodDays = days;
        response.totalEditors = editors.size();
        response.activeEditors = editors.stream().filter(e -> e.getStatus() == UserStatus.ACTIVE).count();
        response.suspendedEditors = editors.stream().filter(e -> e.getStatus() == UserStatus.SUSPENDED).count();
        response.pendingEditors = editors.stream().filter(e -> e.getStatus() == UserStatus.PENDING_ACTIVATION).count();

        long approved = editorRequestRepository.countByStatus("APPROVED");
        long rejected = editorRequestRepository.countByStatus("REJECTED");
        long total = approved + rejected;
        response.approvalRate = total > 0 ? (double) approved / total : 0;

        var metrics = activityMetricsService.getAllMetrics();
        response.editors = editors.stream()
                .map(e -> toPerformance(e, metrics, contributions.get(e.getId())))
                .sorted(Comparator.comparingLong((EditorPerformanceDto p) -> p.contributionCount).reversed())
                .collect(Collectors.toList());

        response.topPerformers = response.editors.stream().limit(10).collect(Collectors.toList());
        response.contributionTrend = buildContributionTrend(since);
        return response;
    }

    private EditorPerformanceDto toPerformance(EditorUser e, Map<Long, ?> metrics, long[] contribution) {
        var m = activityMetricsService.getMetrics(e.getId());
        EditorPerformanceDto dto = new EditorPerformanceDto();
        dto.editorId = e.getId();
        dto.email = e.getEmail();
        dto.username = e.getUsername();
        dto.status = e.getStatus() != null ? e.getStatus().name() : null;
        dto.lastActivityAt = m.lastActivityAt;
        dto.activityScore = m.activityScore;
        if (contribution != null) {
            dto.contributionCount = contribution[0];
            if (contribution[1] > 0) {
                dto.lastContributionAt = Instant.ofEpochMilli(contribution[1]);
            }
        } else {
            dto.contributionCount = 0;
        }
        if (e.getStatus() == UserStatus.SUSPENDED) {
            dto.approvalStatus = "SUSPENDED";
        } else if (e.getStatus() == UserStatus.PENDING_ACTIVATION) {
            dto.approvalStatus = "PENDING";
        } else {
            dto.approvalStatus = "ACTIVE";
        }
        return dto;
    }

    private Map<Long, long[]> loadContributions(List<EditorUser> editors) {
        Map<Long, long[]> map = new HashMap<>();
        for (Object[] row : liveNewsPostRepository.aggregateByAuthor()) {
            Long editorId = (Long) row[0];
            long count = ((Number) row[1]).longValue();
            Instant lastAt = row[2] != null ? (Instant) row[2] : null;
            long[] entry = map.computeIfAbsent(editorId, id -> new long[2]);
            entry[0] += count;
            if (lastAt != null) {
                long ms = lastAt.toEpochMilli();
                if (entry[1] == 0 || ms > entry[1]) entry[1] = ms;
            }
        }
        Map<String, Long> emailToId = editors.stream()
                .collect(Collectors.toMap(EditorUser::getEmail, EditorUser::getId, (a, b) -> a));
        for (Object[] row : topicPostRepository.countByAuthorEmail()) {
            String email = (String) row[0];
            long count = ((Number) row[1]).longValue();
            Long editorId = emailToId.get(email);
            if (editorId == null) continue;
            long[] entry = map.computeIfAbsent(editorId, id -> new long[2]);
            entry[0] += count;
        }
        return map;
    }

    private List<DailyActivityDto> buildContributionTrend(Instant since) {
        Map<LocalDate, Long> daily = new LinkedHashMap<>();
        LocalDate start = since.atZone(ZoneOffset.UTC).toLocalDate();
        LocalDate end = LocalDate.now(ZoneOffset.UTC);
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            daily.put(d, 0L);
        }
        for (Object[] row : liveNewsPostRepository.countContributionsPerDaySince(since)) {
            LocalDate day = LocalDate.parse(String.valueOf(row[0]));
            daily.merge(day, ((Number) row[1]).longValue(), Long::sum);
        }
        return daily.entrySet().stream()
                .map(e -> {
                    DailyActivityDto dto = new DailyActivityDto();
                    dto.date = e.getKey().toString();
                    dto.count = e.getValue();
                    return dto;
                })
                .collect(Collectors.toList());
    }
}
