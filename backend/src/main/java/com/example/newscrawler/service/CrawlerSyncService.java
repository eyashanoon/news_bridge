package com.example.newscrawler.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Service
public class CrawlerSyncService {

    private static final Logger log = LoggerFactory.getLogger(CrawlerSyncService.class);

    private final RestTemplate restTemplate = new RestTemplate();
    private final String crawlerBaseUrl;

    public CrawlerSyncService(@Value("${crawler.server.base-url:http://127.0.0.1:8000}") String crawlerBaseUrl) {
        this.crawlerBaseUrl = crawlerBaseUrl.endsWith("/")
                ? crawlerBaseUrl.substring(0, crawlerBaseUrl.length() - 1)
                : crawlerBaseUrl;
    }

    public void notifyEndpointPoolChanged() {
        CompletableFuture.runAsync(() -> {
            try {
                restTemplate.postForEntity(crawlerBaseUrl + "/control/reload", HttpEntity.EMPTY, Map.class);
            } catch (Exception ex) {
                log.warn("Failed to sync crawler endpoint pool: {}", ex.getMessage());
            }
        });
    }
}
