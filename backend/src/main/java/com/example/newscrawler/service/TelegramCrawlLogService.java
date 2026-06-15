package com.example.newscrawler.service;

import com.example.newscrawler.entity.TelegramChannel;
import com.example.newscrawler.entity.TelegramCrawlLog;
import com.example.newscrawler.repository.TelegramCrawlLogRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class TelegramCrawlLogService {

    private final TelegramCrawlLogRepository crawlLogRepo;

    public TelegramCrawlLogService(TelegramCrawlLogRepository crawlLogRepo) {
        this.crawlLogRepo = crawlLogRepo;
    }

    @Transactional
    public void recordCrawl(TelegramChannel channel, int postsCreated, int postsSkipped, String error) {
        TelegramCrawlLog log = new TelegramCrawlLog();
        log.setChannel(channel);
        Instant now = Instant.now();
        log.setStartedAt(now.minusSeconds(1));
        log.setCompletedAt(now);
        log.setPostsCreated(postsCreated);
        log.setPostsSkipped(postsSkipped);
        if (error != null && !error.isBlank()) {
            log.setStatus(TelegramCrawlLog.CrawlStatus.FAILED);
            log.setErrorMessage(error);
        } else if (postsCreated == 0 && postsSkipped > 0) {
            log.setStatus(TelegramCrawlLog.CrawlStatus.PARTIAL);
        } else {
            log.setStatus(TelegramCrawlLog.CrawlStatus.SUCCESS);
        }
        log.setDurationMs(1000L);
        crawlLogRepo.save(log);
    }

    public Page<TelegramCrawlLog> getHistory(Long channelId, Pageable pageable) {
        return crawlLogRepo.findByChannel_IdOrderByStartedAtDesc(channelId, pageable);
    }
}
