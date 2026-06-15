package com.example.newscrawler.controller;

import com.example.newscrawler.dto.EditorAnalyticsResponse;
import com.example.newscrawler.dto.EditorProfileAnalyticsResponse;
import com.example.newscrawler.dto.EditorStatsResponse;
import com.example.newscrawler.service.EditorManagementService;
import com.example.newscrawler.dto.UserActivityAnalyticsResponse;
import com.example.newscrawler.dto.UserBehaviorProfileResponse;
import com.example.newscrawler.dto.UserGrowthAnalyticsResponse;
import com.example.newscrawler.dto.UserInteractionsAnalyticsResponse;
import com.example.newscrawler.dto.UserPreferencesAnalyticsResponse;
import com.example.newscrawler.dto.UserSummaryAnalyticsResponse;
import com.example.newscrawler.service.EditorAnalyticsService;
import com.example.newscrawler.service.UserAnalyticsService;
import com.example.newscrawler.service.UserIntelligenceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/analytics")
public class UserAnalyticsController {

    @Autowired
    private UserAnalyticsService userAnalyticsService;

    @Autowired
    private UserIntelligenceService userIntelligenceService;

    @Autowired
    private EditorAnalyticsService editorAnalyticsService;

    @Autowired
    private EditorManagementService editorManagementService;

    @GetMapping("/users/growth")
    @PreAuthorize("hasRole('MANAGE_USERS')")
    public UserGrowthAnalyticsResponse getUserGrowth(@RequestParam(defaultValue = "30") int periodDays) {
        return userAnalyticsService.getGrowth(periodDays);
    }

    @GetMapping("/users/activity")
    @PreAuthorize("hasRole('MANAGE_USERS')")
    public UserActivityAnalyticsResponse getUserActivity(@RequestParam(defaultValue = "30") int periodDays) {
        return userAnalyticsService.getActivity(periodDays);
    }

    @GetMapping("/users/summary")
    @PreAuthorize("hasRole('MANAGE_USERS')")
    public UserSummaryAnalyticsResponse getUserSummary() {
        return userAnalyticsService.getSummary();
    }

    @GetMapping("/user-preferences")
    @PreAuthorize("hasRole('MANAGE_USERS')")
    public UserPreferencesAnalyticsResponse getUserPreferences() {
        return userIntelligenceService.getPreferencesAnalytics();
    }

    @GetMapping("/user-interactions")
    @PreAuthorize("hasRole('MANAGE_USERS')")
    public UserInteractionsAnalyticsResponse getUserInteractions(
            @RequestParam(defaultValue = "30") int periodDays) {
        return userIntelligenceService.getInteractionsAnalytics(periodDays);
    }

    @GetMapping("/user-preferences/{userId}/profile")
    @PreAuthorize("hasRole('MANAGE_USERS')")
    public UserBehaviorProfileResponse getUserBehaviorProfile(
            @PathVariable Long userId,
            @RequestParam(defaultValue = "30") int periodDays) {
        return userIntelligenceService.getBehaviorProfile(userId, periodDays);
    }

    @GetMapping("/editors/summary")
    @PreAuthorize("hasRole('MANAGE_USERS') or hasRole('VIEW_EDITOR_INFO')")
    public EditorAnalyticsResponse getEditorAnalytics(@RequestParam(defaultValue = "30") int periodDays) {
        return editorAnalyticsService.getAnalytics(periodDays);
    }

    @GetMapping("/editors/stats")
    @PreAuthorize("hasRole('MANAGE_USERS') or hasRole('VIEW_EDITOR_INFO')")
    public EditorStatsResponse getEditorStats() {
        return editorManagementService.getEditorStats();
    }

    @GetMapping("/editors/{editorId}")
    @PreAuthorize("hasRole('MANAGE_USERS') or hasRole('VIEW_EDITOR_INFO')")
    public EditorProfileAnalyticsResponse getEditorProfileAnalytics(
            @PathVariable Long editorId,
            @RequestParam(defaultValue = "30") int periodDays) {
        return editorManagementService.getEditorProfileAnalytics(editorId, periodDays);
    }
}
