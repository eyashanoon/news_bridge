package com.example.newscrawler.controller;

import com.example.newscrawler.dto.TelegramChannelBrowseDto;
import com.example.newscrawler.dto.TelegramFeedPostDto;
import com.example.newscrawler.entity.AppUser;
import com.example.newscrawler.service.AppUserResolver;
import com.example.newscrawler.service.TelegramFeedService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/telegram")
public class TelegramFeedController {

    @Autowired
    private TelegramFeedService feedService;

    @Autowired
    private AppUserResolver appUserResolver;

    /** Tab 1 — For You: Telegram channel preferences balanced with site tag preferences. */
    @GetMapping("/feed/for-you")
    public List<TelegramFeedPostDto> getForYou(
            @RequestParam(defaultValue = "android-app-anonymous") String userId,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(required = false) String excludeIds,
            HttpServletRequest request) {
        AppUser user = appUserResolver.resolve(request, userId);
        return feedService.getForYouFeed(user, limit, page, parseExcludeIds(excludeIds));
    }

    /** Tab 2 — Posts from one channel. */
    @GetMapping("/feed/by-channel")
    public List<TelegramFeedPostDto> getByChannel(
            @RequestParam Long channelId,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(required = false) String excludeIds) {
        return feedService.getByChannelFeed(channelId, limit, page, parseExcludeIds(excludeIds));
    }

    /** Tab 3 — Discover posts via channel admin profile / content tags. */
    @GetMapping("/feed/discover")
    public List<TelegramFeedPostDto> discover(
            @RequestParam String q,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(required = false) String excludeIds) {
        return feedService.discoverByContent(q, limit, page, parseExcludeIds(excludeIds));
    }

    /** Channel picker for Tab 2. */
    @GetMapping("/channels/browse")
    public List<TelegramChannelBrowseDto> browseChannels(
            @RequestParam(required = false) String q) {
        return feedService.browseChannels(q);
    }

    /** Popular extracted tags for Discover suggestions. */
    @GetMapping("/tags/popular")
    public List<String> popularTags(@RequestParam(defaultValue = "12") int limit) {
        return feedService.getPopularTags(Math.min(limit, 30));
    }

    /** Record that the user viewed a Telegram channel post (builds For You preferences). */
    @PostMapping("/interactions/view")
    public void recordView(
            @RequestParam(defaultValue = "android-app-anonymous") String userId,
            @RequestParam Long channelId,
            @RequestParam(required = false) Long postId,
            @RequestParam(required = false) Double feedScore,
            HttpServletRequest request) {
        AppUser user = appUserResolver.resolve(request, userId);
        feedService.recordContentEngagement(user, channelId, postId, 0.15, feedScore);
    }

    /** Record time spent on a Telegram post — stronger preference signal. */
    @PostMapping("/interactions/time")
    public void recordTime(
            @RequestParam(defaultValue = "android-app-anonymous") String userId,
            @RequestParam Long channelId,
            @RequestParam Long postId,
            @RequestParam double seconds,
            HttpServletRequest request) {
        AppUser user = appUserResolver.resolve(request, userId);
        feedService.recordReadTime(user, channelId, postId, seconds);
    }

    /** Legacy endpoint — redirects to for-you feed. */
    @GetMapping("/feed")
    public List<TelegramFeedPostDto> getFeed(
            @RequestParam(defaultValue = "android-app-anonymous") String userId,
            @RequestParam(defaultValue = "General") String category,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(required = false) String excludeIds,
            HttpServletRequest request) {
        AppUser user = appUserResolver.resolve(request, userId);
        return feedService.getForYouFeed(user, limit, page, parseExcludeIds(excludeIds));
    }

    private static List<Long> parseExcludeIds(String excludeIds) {
        if (excludeIds == null || excludeIds.isBlank()) return List.of();
        return Arrays.stream(excludeIds.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(s -> {
                    try {
                        return Long.parseLong(s);
                    } catch (NumberFormatException ex) {
                        return null;
                    }
                })
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toList());
    }
}
