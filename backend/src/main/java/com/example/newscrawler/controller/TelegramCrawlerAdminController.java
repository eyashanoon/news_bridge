package com.example.newscrawler.controller;

import com.example.newscrawler.service.TelegramCrawlerAdminService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/admin/telegram-crawler")
public class TelegramCrawlerAdminController {

    @Autowired
    private TelegramCrawlerAdminService crawlerService;

    @GetMapping("/health")
    @PreAuthorize("hasRole('CONTROL_TELEGRAM_CRAWLER') or hasRole('VIEW_TELEGRAM_POSTS')")
    public Map<String, Object> health() {
        return crawlerService.health();
    }

    @GetMapping("/last-run")
    @PreAuthorize("hasRole('CONTROL_TELEGRAM_CRAWLER') or hasRole('VIEW_TELEGRAM_POSTS')")
    public Map<String, Object> lastRun() {
        return crawlerService.lastRun();
    }

    @GetMapping("/status")
    @PreAuthorize("hasRole('CONTROL_TELEGRAM_CRAWLER') or hasRole('VIEW_TELEGRAM_POSTS')")
    public Map<String, Object> schedulerStatus() {
        return crawlerService.schedulerStatus();
    }

    @PostMapping("/run-now")
    @PreAuthorize("hasRole('CONTROL_TELEGRAM_CRAWLER')")
    public Map<String, Object> runNow() {
        return crawlerService.runNow();
    }

    @PostMapping("/start")
    @PreAuthorize("hasRole('CONTROL_TELEGRAM_CRAWLER')")
    public Map<String, Object> startScheduler() {
        return crawlerService.startScheduler();
    }

    @PostMapping("/stop")
    @PreAuthorize("hasRole('CONTROL_TELEGRAM_CRAWLER')")
    public Map<String, Object> stopScheduler() {
        return crawlerService.stopScheduler();
    }

    @GetMapping("/logs")
    @PreAuthorize("hasRole('CONTROL_TELEGRAM_CRAWLER') or hasRole('VIEW_TELEGRAM_POSTS')")
    public Map<String, Object> getLogs(
            @RequestParam(required = false) String since,
            @RequestParam(defaultValue = "200") int limit) {
        return crawlerService.getLogs(since, limit);
    }

    @DeleteMapping("/logs")
    @PreAuthorize("hasRole('CONTROL_TELEGRAM_CRAWLER')")
    public Map<String, Object> clearLogs() {
        return crawlerService.deleteLogs();
    }

    @PostMapping("/interval")
    @PreAuthorize("hasRole('CONTROL_TELEGRAM_CRAWLER')")
    public Map<String, Object> setInterval(@RequestBody Map<String, Integer> body) {
        int minutes = body.getOrDefault("minutes", 5);
        return crawlerService.setInterval(minutes);
    }

    @GetMapping("/search")
    @PreAuthorize("hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('MANAGE_USERS')")
    public Map<String, Object> searchChannels(@RequestParam String q) {
        return crawlerService.searchChannels(q);
    }
}
