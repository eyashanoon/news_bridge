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
 * Loads and caches MBFC bias/credibility ratings from the open-source
 * drmikecrowe/mbfcext combined.json dataset (MIT license).
 */
@Component
public class MbfcRatingsCache {

    private static final Logger log = LoggerFactory.getLogger(MbfcRatingsCache.class);
    private static final long CACHE_TTL_MS = 24 * 60 * 60 * 1000L;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    private final String ratingsUrl;

    private volatile CacheEntry cache;

    public MbfcRatingsCache(
            ObjectMapper objectMapper,
            @Value("${verification.mbfc-ratings-url:https://raw.githubusercontent.com/drmikecrowe/mbfcext/main/docs/v3/combined.json}")
            String ratingsUrl
    ) {
        this.objectMapper = objectMapper;
        this.ratingsUrl = ratingsUrl;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(8_000);
        factory.setReadTimeout(30_000);
        this.restTemplate = new RestTemplate(factory);
    }

    public Optional<MbfcEntry> lookup(String domain) {
        MbfcDataset dataset = loadDataset();
        if (dataset == null) {
            return Optional.empty();
        }
        String normalized = normalizeDomain(domain);
        if (normalized.isBlank()) {
            return Optional.empty();
        }

        Optional<MbfcEntry> direct = resolve(dataset, normalized);
        if (direct.isPresent()) {
            return direct;
        }

        // Walk up subdomains: edition.cnn.com -> cnn.com
        String[] labels = normalized.split("\\.");
        while (labels.length > 2) {
            String parent = String.join(".", java.util.Arrays.copyOfRange(labels, 1, labels.length));
            direct = resolve(dataset, parent);
            if (direct.isPresent()) {
                return direct;
            }
            labels = parent.split("\\.");
        }

        return Optional.empty();
    }

    private Optional<MbfcEntry> resolve(MbfcDataset dataset, String domain) {
        MbfcEntry entry = dataset.sources().get(domain);
        if (entry != null) {
            return Optional.of(entry);
        }
        String aliased = dataset.aliases().get(domain);
        if (aliased != null) {
            entry = dataset.sources().get(aliased);
            if (entry != null) {
                return Optional.of(entry);
            }
        }
        return Optional.empty();
    }

    public Optional<String> biasDescription(String biasCode, MbfcDataset dataset) {
        if (biasCode == null || dataset == null) {
            return Optional.empty();
        }
        String key = switch (biasCode) {
            case "L" -> "left";
            case "LC" -> "left-center";
            case "C" -> "center";
            case "RC" -> "right-center";
            case "R" -> "right";
            case "CP" -> "conspiracy";
            case "FN" -> "fake-news";
            case "PS" -> "pro-science";
            case "S" -> "satire";
            default -> null;
        };
        if (key == null) {
            return Optional.empty();
        }
        JsonNode node = dataset.rawBiases().get(key);
        if (node == null || !node.has("description")) {
            return Optional.empty();
        }
        return Optional.of(node.get("description").asText());
    }

    public MbfcDataset loadDataset() {
        CacheEntry current = cache;
        if (current != null && !current.isExpired()) {
            return current.dataset();
        }
        synchronized (this) {
            current = cache;
            if (current != null && !current.isExpired()) {
                return current.dataset();
            }
            MbfcDataset loaded = fetchDataset();
            if (loaded != null) {
                cache = new CacheEntry(loaded, Instant.now().toEpochMilli() + CACHE_TTL_MS);
            }
            return loaded;
        }
    }

    private MbfcDataset fetchDataset() {
        try {
            String json = restTemplate.getForObject(ratingsUrl, String.class);
            if (json == null || json.isBlank()) {
                return null;
            }
            JsonNode root = objectMapper.readTree(json);
            Map<String, String> aliases = new HashMap<>();
            JsonNode aliasesNode = root.get("aliases");
            if (aliasesNode != null && aliasesNode.isObject()) {
                aliasesNode.fields().forEachRemaining(e -> aliases.put(e.getKey(), e.getValue().asText()));
            }

            Map<String, MbfcEntry> sources = new HashMap<>();
            JsonNode sourcesNode = root.get("sources");
            if (sourcesNode != null && sourcesNode.isObject()) {
                sourcesNode.fields().forEachRemaining(e -> {
                    JsonNode s = e.getValue();
                    sources.put(e.getKey(), new MbfcEntry(
                            textOrNull(s, "d"),
                            textOrNull(s, "n"),
                            textOrNull(s, "b"),
                            textOrNull(s, "r"),
                            textOrNull(s, "c"),
                            textOrNull(s, "u")
                    ));
                });
            }

            JsonNode biasesNode = root.get("biases");
            return new MbfcDataset(
                    Collections.unmodifiableMap(aliases),
                    Collections.unmodifiableMap(sources),
                    biasesNode == null ? objectMapper.createObjectNode() : biasesNode,
                    textOrNull(root, "date")
            );
        } catch (Exception ex) {
            log.warn("Failed to load MBFC ratings from {}: {}", ratingsUrl, ex.getMessage());
            return null;
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

    public record MbfcEntry(
            String domain,
            String name,
            String biasCode,
            String reportingCode,
            String credibilityCode,
            String reviewUrl
    ) {}

    public record MbfcDataset(
            Map<String, String> aliases,
            Map<String, MbfcEntry> sources,
            JsonNode rawBiases,
            String datasetDate
    ) {}

    private record CacheEntry(MbfcDataset dataset, long expiresAtMs) {
        boolean isExpired() {
            return System.currentTimeMillis() > expiresAtMs;
        }
    }
}
