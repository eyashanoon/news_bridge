package com.example.newscrawler.service;

import com.example.newscrawler.dto.AdminActivityLogPageResponse;
import com.example.newscrawler.dto.AdminActivityLogResponse;
import com.example.newscrawler.entity.Admin;
import com.example.newscrawler.entity.AdminActivityAction;
import com.example.newscrawler.entity.AdminActivityLog;
import com.example.newscrawler.repository.AdminActivityLogRepository;
import com.example.newscrawler.repository.AdminRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class AdminActivityLogService {

    @Autowired
    private AdminActivityLogRepository logRepository;

    @Autowired
    private AdminRepository adminRepository;

    @Transactional
    public void logSuccess(AdminActivityAction action, String targetResource, String result) {
        persist(action, targetResource, result, "SUCCESS");
    }

    @Transactional
    public void logFailure(AdminActivityAction action, String targetResource, String result) {
        persist(action, targetResource, result, "FAILURE");
    }

    @Transactional
    public void logAsAdmin(String adminEmail, Long adminId, AdminActivityAction action,
                           String targetResource, String result, String status) {
        AdminActivityLog entry = new AdminActivityLog();
        entry.setAdminEmail(adminEmail);
        entry.setAdminId(adminId);
        entry.setAction(action);
        entry.setTargetResource(truncate(targetResource, 512));
        entry.setResult(truncate(result, 1024));
        entry.setStatus(status != null ? status : "SUCCESS");
        entry.setTimestamp(Instant.now());
        logRepository.save(entry);

        if (adminId != null) {
            adminRepository.findById(adminId).ifPresent(admin -> {
                admin.setLastActivityAt(Instant.now());
                adminRepository.save(admin);
            });
        } else if (adminEmail != null) {
            adminRepository.findByEmail(adminEmail).ifPresent(admin -> {
                admin.setLastActivityAt(Instant.now());
                adminRepository.save(admin);
            });
        }
    }

    public AdminActivityLogPageResponse search(
            String search,
            String action,
            String status,
            String adminEmail,
            Instant from,
            Instant to,
            int page,
            int size
    ) {
        AdminActivityAction parsedAction = null;
        if (action != null && !action.isBlank()) {
            try {
                parsedAction = AdminActivityAction.valueOf(action);
            } catch (IllegalArgumentException ignored) {
                // invalid filter — return empty page
            }
        }

        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "timestamp"));
        Page<AdminActivityLog> resultPage = logRepository.search(
                search, parsedAction, status, adminEmail, from, to, pageable
        );

        AdminActivityLogPageResponse response = new AdminActivityLogPageResponse();
        response.page = page;
        response.size = size;
        response.totalElements = resultPage.getTotalElements();
        response.totalPages = resultPage.getTotalPages();
        response.items = resultPage.getContent().stream().map(this::map).collect(Collectors.toList());
        return response;
    }

    public String resolveActivityLevel(String adminEmail, Instant lastActivityAt) {
        Instant since = Instant.now().minusSeconds(30L * 24 * 3600);
        long count = logRepository.countByAdminEmailAndTimestampAfter(adminEmail, since);
        if (count >= 50) return "HIGH";
        if (count >= 10) return "MEDIUM";
        if (count >= 1 || (lastActivityAt != null && lastActivityAt.isAfter(since))) return "LOW";
        return "INACTIVE";
    }

    private void persist(AdminActivityAction action, String targetResource, String result, String status) {
        String email = currentActorEmail();
        Long adminId = null;
        if (email != null) {
            adminId = adminRepository.findByEmail(email).map(Admin::getId).orElse(null);
        }
        logAsAdmin(email != null ? email : "system", adminId, action, targetResource, result, status);
    }

    private String currentActorEmail() {
        try {
            var auth = SecurityContextHolder.getContext().getAuthentication();
            if (auth == null || !auth.isAuthenticated()) return null;
            return auth.getName();
        } catch (Exception e) {
            return null;
        }
    }

    private AdminActivityLogResponse map(AdminActivityLog log) {
        AdminActivityLogResponse dto = new AdminActivityLogResponse();
        dto.id = log.getId();
        dto.adminId = log.getAdminId();
        dto.adminEmail = log.getAdminEmail();
        dto.action = log.getAction().name();
        dto.timestamp = log.getTimestamp();
        dto.status = log.getStatus();
        dto.targetResource = log.getTargetResource();
        dto.result = log.getResult();
        return dto;
    }

    private static String truncate(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }
}
