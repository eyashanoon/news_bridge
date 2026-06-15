package com.example.newscrawler.controller;

import com.example.newscrawler.dto.AdminActivityLogPageResponse;
import com.example.newscrawler.dto.AdminAnalyticsResponse;
import com.example.newscrawler.dto.PermissionGroupResponse;
import com.example.newscrawler.rbac.PermissionGroups;
import com.example.newscrawler.service.AdminActivityLogService;
import com.example.newscrawler.service.AdminAnalyticsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/management")
public class AdminManagementController {

    @Autowired
    private AdminActivityLogService activityLogService;

    @Autowired
    private AdminAnalyticsService analyticsService;

    @GetMapping("/permission-groups")
    @PreAuthorize("hasRole('CREATE_ADMIN') or hasRole('MANAGE_USERS')")
    public List<PermissionGroupResponse> listPermissionGroups() {
        return PermissionGroups.all().stream().map(def -> {
            PermissionGroupResponse dto = new PermissionGroupResponse();
            dto.id = def.id();
            dto.label = def.label();
            dto.description = def.description();
            dto.roles = def.roles().stream().map(Enum::name).collect(Collectors.toList());
            dto.features = def.features();
            return dto;
        }).collect(Collectors.toList());
    }

    @GetMapping("/activity-logs")
    @PreAuthorize("hasRole('VIEW_ADMIN_ACTIVITY') or hasRole('CREATE_ADMIN')")
    public AdminActivityLogPageResponse getActivityLogs(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String action,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String adminEmail,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return activityLogService.search(search, action, status, adminEmail, from, to, page, size);
    }

    @GetMapping("/analytics")
    @PreAuthorize("hasRole('VIEW_ADMIN_ACTIVITY') or hasRole('CREATE_ADMIN')")
    public AdminAnalyticsResponse getAnalytics(
            @RequestParam(defaultValue = "30") int periodDays
    ) {
        return analyticsService.getAnalytics(periodDays);
    }
}
