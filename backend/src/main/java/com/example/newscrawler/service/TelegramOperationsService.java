package com.example.newscrawler.service;

import com.example.newscrawler.dto.LabelCountDto;
import com.example.newscrawler.dto.TelegramCrawlerDashboardDto;
import com.example.newscrawler.entity.TelegramCrawlLog;
import com.example.newscrawler.repository.TelegramCrawlLogRepository;
import com.example.newscrawler.repository.TelegramPostRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class TelegramOperationsService {

    private final TelegramCrawlerAdminService crawlerAdminService;
    private final TelegramPostRepository postRepo;
    private final TelegramCrawlLogRepository crawlLogRepo;

    public TelegramOperationsService(TelegramCrawlerAdminService crawlerAdminService,
                                     TelegramPostRepository postRepo,
                                     TelegramCrawlLogRepository crawlLogRepo) {
        this.crawlerAdminService = crawlerAdminService;
        this.postRepo = postRepo;
        this.crawlLogRepo = crawlLogRepo;
    }

    public TelegramCrawlerDashboardDto getDashboard() {
        TelegramCrawlerDashboardDto dto = new TelegramCrawlerDashboardDto();
        try {
            dto.crawlerStatus = crawlerAdminService.schedulerStatus();
        } catch (Exception e) {
            dto.crawlerStatus = Map.of("error", e.getMessage());
        }

        long tagged = postRepo.countByTagsExtracted(true);
        long untagged = postRepo.countByTagsExtracted(false);
        dto.taggedPosts = tagged;
        dto.pendingPosts = untagged;
        dto.taggingSuccessRate = (tagged + untagged) == 0 ? 0.0
                : Math.round((tagged * 100.0 / (tagged + untagged)) * 10) / 10.0;

        Instant since = Instant.now().minus(7, ChronoUnit.DAYS);
        dto.averageCrawlTimeMs = crawlLogRepo.avgDurationMsSince(since);
        dto.averagePostsRetrieved = crawlLogRepo.avgPostsCreatedSince(since);

        List<Object[]> statusRows = crawlLogRepo.aggregateStatusSince(since);
        long success = 0, failed = 0;
        for (Object[] row : statusRows) {
            TelegramCrawlLog.CrawlStatus st = (TelegramCrawlLog.CrawlStatus) row[0];
            long cnt = ((Number) row[1]).longValue();
            if (st == TelegramCrawlLog.CrawlStatus.SUCCESS) success += cnt;
            else if (st == TelegramCrawlLog.CrawlStatus.FAILED) failed += cnt;
        }
        long total = success + failed;
        dto.crawlSuccessRate = total == 0 ? 0.0 : Math.round((success * 100.0 / total) * 10) / 10.0;
        dto.crawlStatusBreakdown = statusRows.stream()
                .map(r -> new LabelCountDto(String.valueOf(r[0]), ((Number) r[1]).longValue()))
                .collect(Collectors.toList());
        return dto;
    }
}
