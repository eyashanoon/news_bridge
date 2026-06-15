package com.example.newscrawler.service;

import com.example.newscrawler.dto.ActionTypeCountDto;
import com.example.newscrawler.dto.AdminActivityCountDto;
import com.example.newscrawler.dto.AdminAnalyticsResponse;
import com.example.newscrawler.dto.DailyActivityDto;
import com.example.newscrawler.dto.RoleDistributionDto;
import com.example.newscrawler.dto.StatusCountDto;
import com.example.newscrawler.entity.Admin;
import com.example.newscrawler.entity.AdminActivityLog;
import com.example.newscrawler.entity.UserRole;
import com.example.newscrawler.repository.AdminActivityLogRepository;
import com.example.newscrawler.repository.AdminRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class AdminAnalyticsService {

    @Autowired
    private AdminActivityLogRepository logRepository;

    @Autowired
    private AdminRepository adminRepository;

    public AdminAnalyticsResponse getAnalytics(int periodDays) {
        int days = Math.max(1, Math.min(periodDays, 90));
        Instant since = Instant.now().minusSeconds((long) days * 24 * 3600);
        List<AdminActivityLog> logs = logRepository.findByTimestampAfterOrderByTimestampDesc(since);

        long successCount = logs.stream().filter(l -> "SUCCESS".equalsIgnoreCase(l.getStatus())).count();
        long failureCount = logs.stream().filter(l -> "FAILURE".equalsIgnoreCase(l.getStatus())).count();
        long distinctAdmins = logs.stream().map(AdminActivityLog::getAdminEmail).distinct().count();

        AdminAnalyticsResponse response = new AdminAnalyticsResponse();
        response.periodDays = days;
        response.totalActions = logs.size();
        response.activeAdmins = distinctAdmins;
        response.successCount = successCount;
        response.failureCount = failureCount;
        response.successRate = logs.isEmpty() ? 0.0 : (successCount * 100.0) / logs.size();
        response.avgActionsPerDay = days > 0 ? (double) logs.size() / days : 0.0;
        response.mostActiveAdmins = buildMostActive(logs);
        response.actionsPerDay = buildDaily(logs, days, since);
        response.actionsByType = buildByType(logs);
        response.actionsByStatus = buildByStatus(logs);
        response.roleDistribution = buildRoleDistribution();
        return response;
    }

    private List<AdminActivityCountDto> buildMostActive(List<AdminActivityLog> logs) {
        Map<String, Long> counts = new HashMap<>();
        for (AdminActivityLog log : logs) {
            counts.merge(log.getAdminEmail(), 1L, Long::sum);
        }
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(10)
                .map(e -> {
                    AdminActivityCountDto dto = new AdminActivityCountDto();
                    dto.adminEmail = e.getKey();
                    dto.actionCount = e.getValue();
                    return dto;
                })
                .collect(Collectors.toList());
    }

    private List<DailyActivityDto> buildDaily(List<AdminActivityLog> logs, int days, Instant since) {
        Map<LocalDate, Long> counts = new LinkedHashMap<>();
        LocalDate start = since.atZone(ZoneOffset.UTC).toLocalDate();
        LocalDate end = LocalDate.now(ZoneOffset.UTC);
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            counts.put(d, 0L);
        }
        for (AdminActivityLog log : logs) {
            LocalDate day = log.getTimestamp().atZone(ZoneOffset.UTC).toLocalDate();
            counts.merge(day, 1L, Long::sum);
        }
        return counts.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(e -> {
                    DailyActivityDto dto = new DailyActivityDto();
                    dto.date = e.getKey().toString();
                    dto.count = e.getValue();
                    return dto;
                })
                .collect(Collectors.toList());
    }

    private List<ActionTypeCountDto> buildByType(List<AdminActivityLog> logs) {
        Map<String, Long> counts = new HashMap<>();
        for (AdminActivityLog log : logs) {
            counts.merge(log.getAction().name(), 1L, Long::sum);
        }
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(e -> {
                    ActionTypeCountDto dto = new ActionTypeCountDto();
                    dto.action = e.getKey();
                    dto.count = e.getValue();
                    return dto;
                })
                .collect(Collectors.toList());
    }

    private List<StatusCountDto> buildByStatus(List<AdminActivityLog> logs) {
        Map<String, Long> counts = new HashMap<>();
        for (AdminActivityLog log : logs) {
            String status = log.getStatus() == null ? "UNKNOWN" : log.getStatus().toUpperCase();
            counts.merge(status, 1L, Long::sum);
        }
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(e -> {
                    StatusCountDto dto = new StatusCountDto();
                    dto.status = e.getKey();
                    dto.count = e.getValue();
                    return dto;
                })
                .collect(Collectors.toList());
    }

    private List<RoleDistributionDto> buildRoleDistribution() {
        Map<String, Long> counts = new HashMap<>();
        List<Admin> admins = adminRepository.findAll();
        for (Admin admin : admins) {
            for (UserRole role : admin.getRoles()) {
                if (role == UserRole.OWNER) continue;
                counts.merge(role.name(), 1L, Long::sum);
            }
        }
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(e -> {
                    RoleDistributionDto dto = new RoleDistributionDto();
                    dto.role = e.getKey();
                    dto.adminCount = e.getValue();
                    return dto;
                })
                .collect(Collectors.toList());
    }
}
