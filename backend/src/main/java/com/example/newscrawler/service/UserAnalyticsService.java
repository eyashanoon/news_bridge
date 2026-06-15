package com.example.newscrawler.service;

import com.example.newscrawler.dto.DailyActivityDto;
import com.example.newscrawler.dto.RoleDistributionDto;
import com.example.newscrawler.dto.UserActivityAnalyticsResponse;
import com.example.newscrawler.dto.UserActivityMetricsDto;
import com.example.newscrawler.dto.UserGrowthAnalyticsResponse;
import com.example.newscrawler.dto.UserSummaryAnalyticsResponse;
import com.example.newscrawler.entity.EditorUser;
import com.example.newscrawler.entity.RegisteredUser;
import com.example.newscrawler.entity.UserRole;
import com.example.newscrawler.entity.UserStatus;
import com.example.newscrawler.repository.EditorUserRepository;
import com.example.newscrawler.repository.LoginDeviceRepository;
import com.example.newscrawler.repository.PostInteractionRepository;
import com.example.newscrawler.repository.RegisteredUserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class UserAnalyticsService {

    @Autowired
    private RegisteredUserRepository registeredUserRepository;

    @Autowired
    private EditorUserRepository editorUserRepository;

    @Autowired
    private PostInteractionRepository interactionRepository;

    @Autowired
    private LoginDeviceRepository loginDeviceRepository;

    @Autowired
    private UserActivityMetricsService activityMetricsService;

    public UserGrowthAnalyticsResponse getGrowth(int periodDays) {
        int days = clampPeriod(periodDays);
        Instant since = Instant.now().minusSeconds((long) days * 24 * 3600);

        List<RegisteredUser> users = registeredUserRepository.findAll().stream()
                .filter(u -> !(u instanceof EditorUser))
                .collect(Collectors.toList());
        List<EditorUser> editors = editorUserRepository.findAll();

        Map<LocalDate, Long> daily = new LinkedHashMap<>();
        LocalDate start = since.atZone(ZoneOffset.UTC).toLocalDate();
        LocalDate end = LocalDate.now(ZoneOffset.UTC);
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            daily.put(d, 0L);
        }

        long newInPeriod = 0;
        for (RegisteredUser u : users) {
            if (u.getCreatedAt() != null && u.getCreatedAt().isAfter(since)) {
                LocalDate day = u.getCreatedAt().atZone(ZoneOffset.UTC).toLocalDate();
                daily.merge(day, 1L, Long::sum);
                newInPeriod++;
            }
        }
        for (EditorUser u : editors) {
            if (u.getCreatedAt() != null && u.getCreatedAt().isAfter(since)) {
                LocalDate day = u.getCreatedAt().atZone(ZoneOffset.UTC).toLocalDate();
                daily.merge(day, 1L, Long::sum);
                newInPeriod++;
            }
        }

        UserGrowthAnalyticsResponse response = new UserGrowthAnalyticsResponse();
        response.periodDays = days;
        response.totalNewUsers = newInPeriod;
        response.totalUsers = users.size() + editors.size();
        response.registrationsPerDay = toDailyList(daily);

        long cumulative = users.stream().filter(u -> u.getCreatedAt() != null && u.getCreatedAt().isBefore(since)).count()
                + editors.stream().filter(u -> u.getCreatedAt() != null && u.getCreatedAt().isBefore(since)).count();
        Map<LocalDate, Long> cumulativeMap = new LinkedHashMap<>();
        for (Map.Entry<LocalDate, Long> e : daily.entrySet()) {
            cumulative += e.getValue();
            cumulativeMap.put(e.getKey(), cumulative);
        }
        response.cumulativeGrowth = toDailyList(cumulativeMap);
        return response;
    }

    public UserActivityAnalyticsResponse getActivity(int periodDays) {
        int days = clampPeriod(periodDays);
        LocalDateTime since = LocalDateTime.now().minusDays(days);
        Map<Long, UserActivityMetricsDto> metrics = activityMetricsService.getAllMetrics();

        long active = metrics.values().stream()
                .filter(m -> m.lastActivityAt != null
                        && m.lastActivityAt.isAfter(Instant.now().minusSeconds((long) days * 24 * 3600)))
                .count();
        long totalUsers = registeredUserRepository.count() + editorUserRepository.count();
        long inactive = Math.max(0, totalUsers - active);

        UserActivityAnalyticsResponse response = new UserActivityAnalyticsResponse();
        response.periodDays = days;
        response.activeUsers = active;
        response.inactiveUsers = inactive;
        response.totalSessions = loginDeviceRepository.count();
        response.interactionsPerDay = mapDailyRows(interactionRepository.countInteractionsPerDaySince(since));
        response.activeUsersPerDay = mapDailyRows(interactionRepository.countActiveUsersPerDaySince(since));
        response.activityHeatmap = mapHourlyRows(interactionRepository.countInteractionsByHourSince(since));
        return response;
    }

    public UserSummaryAnalyticsResponse getSummary() {
        List<RegisteredUser> registered = registeredUserRepository.findAll().stream()
                .filter(u -> !(u instanceof EditorUser))
                .collect(Collectors.toList());
        List<EditorUser> editors = editorUserRepository.findAll();
        Map<Long, UserActivityMetricsDto> metrics = activityMetricsService.getAllMetrics();

        UserSummaryAnalyticsResponse response = new UserSummaryAnalyticsResponse();
        response.totalRegisteredUsers = registered.size();
        response.totalEditors = editors.size();
        response.activeUsers = countByStatus(registered, editors, UserStatus.ACTIVE);
        response.suspendedUsers = countByStatus(registered, editors, UserStatus.SUSPENDED);
        response.pendingUsers = countByStatus(registered, editors, UserStatus.PENDING_ACTIVATION);
        response.inactiveUsers = metrics.values().stream()
                .filter(m -> "INACTIVE".equals(m.activityLevel))
                .count();

        double scoreSum = 0;
        int scoreCount = 0;
        for (UserActivityMetricsDto m : metrics.values()) {
            scoreSum += m.activityScore;
            scoreCount++;
        }
        response.averageActivityScore = scoreCount > 0 ? scoreSum / scoreCount : 0;

        Map<String, Long> statusCounts = new HashMap<>();
        for (RegisteredUser u : registered) {
            String s = u.getStatus() != null ? u.getStatus().name() : "UNKNOWN";
            statusCounts.merge(s, 1L, Long::sum);
        }
        for (EditorUser u : editors) {
            String s = u.getStatus() != null ? u.getStatus().name() : "UNKNOWN";
            statusCounts.merge(s, 1L, Long::sum);
        }
        response.statusDistribution = statusCounts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(e -> {
                    RoleDistributionDto dto = new RoleDistributionDto();
                    dto.role = e.getKey();
                    dto.adminCount = e.getValue();
                    return dto;
                })
                .collect(Collectors.toList());

        Map<String, Long> roleCounts = new HashMap<>();
        for (RegisteredUser u : registered) {
            for (UserRole role : u.getRoles()) {
                roleCounts.merge(role.name(), 1L, Long::sum);
            }
        }
        for (EditorUser u : editors) {
            for (UserRole role : u.getRoles()) {
                roleCounts.merge(role.name(), 1L, Long::sum);
            }
        }
        response.roleDistribution = roleCounts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(15)
                .map(e -> {
                    RoleDistributionDto dto = new RoleDistributionDto();
                    dto.role = e.getKey();
                    dto.adminCount = e.getValue();
                    return dto;
                })
                .collect(Collectors.toList());
        return response;
    }

    private long countByStatus(List<RegisteredUser> registered, List<EditorUser> editors, UserStatus status) {
        long count = registered.stream().filter(u -> u.getStatus() == status).count();
        count += editors.stream().filter(u -> u.getStatus() == status).count();
        return count;
    }

    private int clampPeriod(int periodDays) {
        return Math.max(1, Math.min(periodDays, 90));
    }

    private List<DailyActivityDto> toDailyList(Map<LocalDate, Long> daily) {
        return daily.entrySet().stream()
                .map(e -> {
                    DailyActivityDto dto = new DailyActivityDto();
                    dto.date = e.getKey().toString();
                    dto.count = e.getValue();
                    return dto;
                })
                .collect(Collectors.toList());
    }

    private List<DailyActivityDto> mapDailyRows(List<Object[]> rows) {
        return rows.stream().map(row -> {
            DailyActivityDto dto = new DailyActivityDto();
            dto.date = String.valueOf(row[0]);
            dto.count = ((Number) row[1]).longValue();
            return dto;
        }).collect(Collectors.toList());
    }

    private List<DailyActivityDto> mapHourlyRows(List<Object[]> rows) {
        return rows.stream().map(row -> {
            DailyActivityDto dto = new DailyActivityDto();
            dto.date = row[0] + ":00";
            dto.count = ((Number) row[1]).longValue();
            return dto;
        }).collect(Collectors.toList());
    }
}
