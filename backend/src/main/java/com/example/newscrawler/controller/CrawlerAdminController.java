package com.example.newscrawler.controller;

import com.example.newscrawler.service.CrawlerAdminService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/crawler")
public class CrawlerAdminController {

    @Autowired
    private CrawlerAdminService crawlerAdminService;

    @GetMapping("/health")
    @PreAuthorize("hasRole('VIEW_CRAWLER_LOGS') or hasRole('CONTROL_CRAWLER')")
    public Map<String, Object> health() {
        return crawlerAdminService.health();
    }

    @GetMapping("/last-run")
    @PreAuthorize("hasRole('VIEW_CRAWLER_LOGS') or hasRole('CONTROL_CRAWLER')")
    public Map<String, Object> lastRun() {
        return crawlerAdminService.lastRun();
    }

    @GetMapping("/status")
    @PreAuthorize("hasRole('VIEW_CRAWLER_LOGS') or hasRole('CONTROL_CRAWLER')")
    public Map<String, Object> schedulerStatus() {
        return crawlerAdminService.schedulerStatus();
    }

    @GetMapping("/details")
    @PreAuthorize("hasRole('VIEW_CRAWLER_LOGS') or hasRole('CONTROL_CRAWLER')")
    public Map<String, Object> details() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("health", crawlerAdminService.health());
        payload.put("status", crawlerAdminService.schedulerStatus());
        payload.put("lastRun", crawlerAdminService.lastRun());
        return payload;
    }

    @PostMapping("/run-now")
    @PreAuthorize("hasRole('CONTROL_CRAWLER')")
    public Map<String, Object> runNow() {
        return crawlerAdminService.runNow();
    }

    @PostMapping("/start")
    @PreAuthorize("hasRole('CONTROL_CRAWLER')")
    public Map<String, Object> startScheduler() {
        return crawlerAdminService.startScheduler();
    }

    @PostMapping("/stop")
    @PreAuthorize("hasRole('CONTROL_CRAWLER')")
    public Map<String, Object> stopScheduler() {
        return crawlerAdminService.stopScheduler();
    }

    @GetMapping("/logs")
    @PreAuthorize("hasRole('VIEW_CRAWLER_LOGS') or hasRole('CONTROL_CRAWLER')")
    public Map<String, Object> getLogs(
            @RequestParam(required = false) String since,
            @RequestParam(defaultValue = "200") int limit) {
        return crawlerAdminService.getLogs(since, limit);
    }

    @DeleteMapping("/logs")
    @PreAuthorize("hasRole('CONTROL_CRAWLER')")
    public Map<String, Object> clearLogs() {
        return crawlerAdminService.deleteLogs();
    }

    @PostMapping("/interval")
    @PreAuthorize("hasRole('CONTROL_CRAWLER')")
    public Map<String, Object> setInterval(@RequestBody Map<String, Integer> body) {
        int minutes = body.getOrDefault("minutes", 5);
        return crawlerAdminService.setInterval(minutes);
    }
}
