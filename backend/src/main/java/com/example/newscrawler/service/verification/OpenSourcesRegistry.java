package com.example.newscrawler.service.verification;

import java.time.Instant;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

/**
 * OpenSources.co unreliable-domain list (CC BY 4.0).
 */
@Component
public class OpenSourcesRegistry {

    private static final Logger log = LoggerFactory.getLogger(OpenSourcesRegistry.class);
    private static final long CACHE_TTL_MS = 24 * 60 * 60 * 1000L;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String sourcesUrl;

    private volatile CacheEntry cache;

    public OpenSourcesRegistry(
            ObjectMapper objectMapper,
            @Value("${verification.opensources-url:https://raw.githubusercontent.com/BigMcLargeHuge/opensources/master/sources/sources.json}")
            String sourcesUrl
    ) {
        this.objectMapper = objectMapper;
        this.sourcesUrl = sourcesUrl;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(8_000);
        factory.setReadTimeout(20_000);
        this.restTemplate = new RestTemplate(factory);
    }

    public Optional<OpenSourcesEntry> lookup(String domain) {
        Map<String, OpenSourcesEntry> entries = loadEntries();
        if (entries.isEmpty()) {
            return Optional.empty();
        }
        String normalized = normalizeDomain(domain);
        return Optional.ofNullable(entries.get(normalized));
    }

    private Map<String, OpenSourcesEntry> loadEntries() {
        CacheEntry current = cache;
        if (current != null && !current.isExpired()) {
            return current.entries();
        }
        synchronized (this) {
            current = cache;
            if (current != null && !current.isExpired()) {
                return current.entries();
            }
            Map<String, OpenSourcesEntry> loaded = fetchEntries();
            cache = new CacheEntry(loaded, Instant.now().toEpochMilli() + CACHE_TTL_MS);
            return loaded;
        }
    }

    private Map<String, OpenSourcesEntry> fetchEntries() {
        try {
            String json = restTemplate.getForObject(sourcesUrl, String.class);
            if (json == null || json.isBlank()) {
                return Map.of();
            }
            JsonNode root = objectMapper.readTree(json);
            Map<String, OpenSourcesEntry> entries = new HashMap<>();
            root.fields().forEachRemaining(e -> {
                JsonNode node = e.getValue();
                entries.put(normalizeDomain(e.getKey()), new OpenSourcesEntry(
                        normalizeDomain(e.getKey()),
                        textOrNull(node, "type"),
                        textOrNull(node, "2nd type"),
                        textOrNull(node, "3rd type"),
                        textOrNull(node, "Source Notes (things to know?)")
                ));
            });
            return Collections.unmodifiableMap(entries);
        } catch (Exception ex) {
            log.warn("Failed to load OpenSources list from {}: {}", sourcesUrl, ex.getMessage());
            return Map.of();
        }
    }

    private static String textOrNull(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private static String normalizeDomain(String domain) {
        String d = domain == null ? "" : domain.trim().toLowerCase();
        if (d.startsWith("www.")) {
            d = d.substring(4);
        }
        return d;
    }

    public record OpenSourcesEntry(
            String domain,
            String primaryType,
            String secondaryType,
            String tertiaryType,
            String notes
    ) {}

    private record CacheEntry(Map<String, OpenSourcesEntry> entries, long expiresAtMs) {
        boolean isExpired() {
            return System.currentTimeMillis() > expiresAtMs;
        }
    }
}
