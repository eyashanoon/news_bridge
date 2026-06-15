package com.example.newscrawler.controller;

import com.example.newscrawler.dto.*;
import com.example.newscrawler.service.*;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.util.List;

@RestController
@RequestMapping("/api/admin/telegram")
public class TelegramAdminController {

    private final TelegramDashboardService dashboardService;
    private final TelegramAdminChannelService channelService;
    private final TelegramAdminPostService postService;
    private final TelegramAnalyticsService analyticsService;
    private final TelegramUserAnalyticsService userAnalyticsService;
    private final TelegramRecommendationInsightsService recommendationService;
    private final TelegramOperationsService operationsService;

    public TelegramAdminController(TelegramDashboardService dashboardService,
                                   TelegramAdminChannelService channelService,
                                   TelegramAdminPostService postService,
                                   TelegramAnalyticsService analyticsService,
                                   TelegramUserAnalyticsService userAnalyticsService,
                                   TelegramRecommendationInsightsService recommendationService,
                                   TelegramOperationsService operationsService) {
        this.dashboardService = dashboardService;
        this.channelService = channelService;
        this.postService = postService;
        this.analyticsService = analyticsService;
        this.userAnalyticsService = userAnalyticsService;
        this.recommendationService = recommendationService;
        this.operationsService = operationsService;
    }

    @GetMapping("/dashboard/kpis")
    @PreAuthorize("hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('VIEW_TELEGRAM_POSTS') or hasRole('MANAGE_USERS')")
    public TelegramDashboardKpisDto getKpis() {
        return dashboardService.getKpis();
    }

    @GetMapping("/channels/countries")
    @PreAuthorize("hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('VIEW_TELEGRAM_POSTS') or hasRole('MANAGE_USERS')")
    public List<String> listChannelCountries() {
        return channelService.listDistinctCountries();
    }

    @GetMapping("/channels")
    @PreAuthorize("hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('VIEW_TELEGRAM_POSTS') or hasRole('MANAGE_USERS')")
    public Page<TelegramChannelAdminDto> searchChannels(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String scope,
            @RequestParam(required = false) String language,
            @RequestParam(required = false) String purpose,
            @RequestParam(required = false) String country,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String tag,
            @RequestParam(defaultValue = "newest") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return channelService.search(q, status, scope, language, purpose, country, category, tag, sort, page, size);
    }

    @GetMapping("/channels/{id}/detail")
    @PreAuthorize("hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('VIEW_TELEGRAM_POSTS') or hasRole('MANAGE_USERS')")
    public TelegramChannelDetailDto getChannelDetail(@PathVariable Long id) {
        return channelService.getDetail(id);
    }

    @GetMapping("/channels/{id}/statistics")
    @PreAuthorize("hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('VIEW_TELEGRAM_POSTS') or hasRole('MANAGE_USERS')")
    public TelegramChannelStatisticsDto getChannelStatistics(@PathVariable Long id) {
        return channelService.getStatistics(id);
    }

    @GetMapping("/channels/{id}/performance")
    @PreAuthorize("hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('VIEW_TELEGRAM_POSTS') or hasRole('MANAGE_USERS')")
    public TelegramChannelPerformanceDto getChannelPerformance(@PathVariable Long id) {
        return channelService.getPerformance(id);
    }

    @GetMapping("/channels/{id}/user-interest")
    @PreAuthorize("hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('VIEW_TELEGRAM_POSTS') or hasRole('MANAGE_USERS')")
    public TelegramChannelUserInterestDto getChannelUserInterest(@PathVariable Long id) {
        return channelService.getUserInterest(id);
    }

    @PostMapping("/channels/{id}/refresh-profile")
    @PreAuthorize("hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('MANAGE_USERS')")
    public void refreshProfile(@PathVariable Long id) {
        channelService.refreshProfile(id);
    }

    @GetMapping("/posts")
    @PreAuthorize("hasRole('VIEW_TELEGRAM_POSTS') or hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('MANAGE_USERS')")
    public Page<TelegramPostAdminDto> searchPosts(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Long channelId,
            @RequestParam(required = false) String tag,
            @RequestParam(required = false) String mediaType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant dateTo,
            @RequestParam(defaultValue = "newest") String sort,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return postService.search(q, channelId, tag, mediaType, dateFrom, dateTo, sort, page, size);
    }

    @GetMapping("/posts/{id}/detail")
    @PreAuthorize("hasRole('VIEW_TELEGRAM_POSTS') or hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('MANAGE_USERS')")
    public TelegramPostDetailDto getPostDetail(@PathVariable Long id) {
        return postService.getDetail(id);
    }

    @PostMapping("/posts/{id}/retag")
    @PreAuthorize("hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('MANAGE_USERS')")
    public void retagPost(@PathVariable Long id) {
        postService.retag(id);
    }

    @GetMapping("/analytics/overview")
    @PreAuthorize("hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('VIEW_TELEGRAM_POSTS') or hasRole('MANAGE_USERS')")
    public TelegramAnalyticsOverviewDto getAnalytics(@RequestParam(defaultValue = "30") int periodDays) {
        return analyticsService.getOverview(periodDays);
    }

    @GetMapping("/user-analytics/overview")
    @PreAuthorize("hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('VIEW_TELEGRAM_POSTS') or hasRole('MANAGE_USERS')")
    public TelegramUserAnalyticsOverviewDto getUserAnalytics() {
        return userAnalyticsService.getOverview();
    }

    @GetMapping("/recommendations/insights")
    @PreAuthorize("hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('VIEW_TELEGRAM_POSTS') or hasRole('MANAGE_USERS')")
    public TelegramRecommendationInsightsDto getRecommendationInsights() {
        return recommendationService.getInsights();
    }

    @GetMapping("/operations/crawler-dashboard")
    @PreAuthorize("hasRole('CONTROL_TELEGRAM_CRAWLER') or hasRole('VIEW_TELEGRAM_POSTS') or hasRole('MANAGE_USERS')")
    public TelegramCrawlerDashboardDto getCrawlerDashboard() {
        return operationsService.getDashboard();
    }

    @GetMapping("/reports/channel/{id}")
    @PreAuthorize("hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('VIEW_TELEGRAM_POSTS') or hasRole('MANAGE_USERS')")
    public ResponseEntity<byte[]> channelReport(@PathVariable Long id,
                                                @RequestParam(defaultValue = "csv") String format) {
        TelegramChannelDetailDto detail = channelService.getDetail(id);
        TelegramChannelStatisticsDto stats = channelService.getStatistics(id);
        TelegramChannelPerformanceDto perf = channelService.getPerformance(id);
        String csv = "section,metric,value\n"
                + "channel,name," + esc(detail.channel.displayName) + "\n"
                + "channel,username," + esc(detail.channel.channelUsername) + "\n"
                + "channel,status," + esc(detail.channel.status) + "\n"
                + "statistics,total_posts," + stats.totalPosts + "\n"
                + "statistics,daily_posts," + stats.dailyPosts + "\n"
                + "performance,crawl_success_rate," + perf.crawlSuccessRate + "\n";
        return csvResponse("channel-" + id + "-report.csv", csv);
    }

    @GetMapping("/reports/platform")
    @PreAuthorize("hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('VIEW_TELEGRAM_POSTS') or hasRole('MANAGE_USERS')")
    public ResponseEntity<byte[]> platformReport(@RequestParam(defaultValue = "csv") String format) {
        TelegramDashboardKpisDto kpis = dashboardService.getKpis();
        String csv = "metric,value\n"
                + "total_channels," + kpis.totalChannels + "\n"
                + "active_channels," + kpis.activeChannels + "\n"
                + "total_posts," + kpis.totalPosts + "\n"
                + "posts_today," + kpis.postsToday + "\n"
                + "active_users," + kpis.activeTelegramUsers + "\n";
        return csvResponse("telegram-platform-report.csv", csv);
    }

    private static String esc(String s) {
        if (s == null) return "";
        return s.replace(",", " ");
    }

    private static ResponseEntity<byte[]> csvResponse(String filename, String csv) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(csv.getBytes(StandardCharsets.UTF_8));
    }
}
