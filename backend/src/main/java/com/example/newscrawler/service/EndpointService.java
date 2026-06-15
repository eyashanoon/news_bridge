package com.example.newscrawler.service;

import java.net.URI;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.example.newscrawler.dto.CreateEndpointRequest;
import com.example.newscrawler.dto.EndpointAnalyticsResponse;
import com.example.newscrawler.dto.EndpointResponse;
import com.example.newscrawler.dto.LabelCountDto;
import com.example.newscrawler.dto.RootEndpointAnalyticsDto;
import com.example.newscrawler.entity.Article;
import com.example.newscrawler.entity.CacheEndpoint;
import com.example.newscrawler.entity.Endpoint;
import com.example.newscrawler.entity.RecordStatus;
import com.example.newscrawler.entity.Root;
import com.example.newscrawler.repository.ArticleRepository;
import com.example.newscrawler.repository.CacheEndpointRepository;
import com.example.newscrawler.repository.EndpointRepository;
import com.example.newscrawler.repository.RootRepository;

@Service
public class EndpointService {

    private final EndpointRepository endpointRepository;
    private final RootRepository rootRepository;
    private final ArticleRepository articleRepository;
    private final CacheEndpointRepository cacheEndpointRepository;
    private final CrawlerSyncService crawlerSyncService;

    public EndpointService(
            EndpointRepository endpointRepository,
            RootRepository rootRepository,
            ArticleRepository articleRepository,
            CacheEndpointRepository cacheEndpointRepository,
            CrawlerSyncService crawlerSyncService
    ) {
        this.endpointRepository = endpointRepository;
        this.rootRepository = rootRepository;
        this.articleRepository = articleRepository;
        this.cacheEndpointRepository = cacheEndpointRepository;
        this.crawlerSyncService = crawlerSyncService;
    }

    public EndpointResponse create(CreateEndpointRequest request) {
        if (endpointRepository.existsByUrl(request.url())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Endpoint URL already exists");
        }

        Root root = resolveRootForEndpoint(request);

        Endpoint endpoint = new Endpoint();
        endpoint.setUrl(request.url());
        endpoint.setRoot(root);
        endpoint.setStatus(RecordStatus.ACTIVE);

        Endpoint saved = endpointRepository.save(endpoint);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<EndpointResponse> findByRoot(Long rootId, String search, String status) {
        RecordStatus parsedStatus = parseStatus(status);
        String normalizedSearch = search == null ? "" : search.trim();

        if (rootId != null && !rootRepository.existsById(rootId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Root not found");
        }

        List<Endpoint> endpoints;
        if (rootId != null && parsedStatus != null) {
            endpoints = endpointRepository.findByRootIdAndStatusAndUrlContainingIgnoreCase(rootId, parsedStatus, normalizedSearch);
        } else if (rootId != null) {
            endpoints = endpointRepository.findByRootIdAndUrlContainingIgnoreCase(rootId, normalizedSearch);
        } else if (parsedStatus != null) {
            endpoints = endpointRepository.findByStatusAndUrlContainingIgnoreCase(parsedStatus, normalizedSearch);
        } else {
            endpoints = endpointRepository.findByUrlContainingIgnoreCase(normalizedSearch);
        }

        return endpoints.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public EndpointResponse findById(Long id) {
        return toResponse(findEndpoint(id));
    }

    public EndpointResponse update(Long id, CreateEndpointRequest request) {
        Endpoint endpoint = findEndpoint(id);

        if (!endpoint.getUrl().equals(request.url()) && endpointRepository.existsByUrlAndIdNot(request.url(), id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Endpoint URL already exists");
        }

        Root root = resolveRootForEndpoint(request);

        endpoint.setUrl(request.url());
        endpoint.setRoot(root);

        return toResponse(endpointRepository.save(endpoint));
    }

    @Transactional
    public EndpointResponse updateStatus(Long id, String status) {
        Endpoint endpoint = findEndpoint(id);
        endpoint.setStatus(parseRequiredStatus(status));
        EndpointResponse response = toResponse(endpointRepository.save(endpoint));
        crawlerSyncService.notifyEndpointPoolChanged();
        return response;
    }

    @Transactional
    public void delete(Long id, boolean hardDelete) {
        if (!endpointRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Endpoint not found");
        }

        if (!hardDelete) {
            Endpoint endpoint = findEndpoint(id);
            endpoint.setStatus(RecordStatus.SUSPENDED);
            endpointRepository.save(endpoint);
            crawlerSyncService.notifyEndpointPoolChanged();
            return;
        }

        // Delete children in FK-safe order: articles first, then cache endpoints, then endpoint.
        java.util.List<Article> articles = articleRepository.findByEndpointId(id);
        if (!articles.isEmpty()) {
            articleRepository.deleteAll(articles);
        }

        java.util.List<CacheEndpoint> cacheEndpoints = cacheEndpointRepository.findBySourceEndpointId(id);
        if (!cacheEndpoints.isEmpty()) {
            cacheEndpointRepository.deleteAll(cacheEndpoints);
        }

        endpointRepository.deleteById(id);
    }

    private Endpoint findEndpoint(Long id) {
        return endpointRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Endpoint not found"));
    }

    private Root resolveRootForEndpoint(CreateEndpointRequest request) {
        if (request.rootId() != null) {
            return rootRepository.findById(request.rootId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Root not found"));
        }

        String domain = extractDomain(request.url());
        return rootRepository.findFirstByBaseUrlContainingIgnoreCase(domain)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.CONFLICT,
                        "Root for domain '" + domain + "' does not exist"
                ));
    }

    private String extractDomain(String url) {
        try {
            URI uri = URI.create(url);
            String host = uri.getHost();
            if (host == null || host.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid endpoint URL");
            }
            return host.toLowerCase(Locale.ROOT);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid endpoint URL");
        }
    }

    private RecordStatus parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return RecordStatus.valueOf(status.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status");
        }
    }

    private RecordStatus parseRequiredStatus(String status) {
        RecordStatus parsed = parseStatus(status);
        if (parsed == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status is required");
        }
        return parsed;
    }

    @Transactional(readOnly = true)
    public EndpointAnalyticsResponse getAnalytics(Long rootId) {
        List<Endpoint> endpoints = rootId != null
                ? endpointRepository.findByRootId(rootId)
                : endpointRepository.findAll();

        long active = endpoints.stream().filter(e -> e.getStatus() == RecordStatus.ACTIVE).count();
        long disabled = endpoints.size() - active;

        Map<Integer, Long> depthCounts = new HashMap<>();
        Map<String, Long> rootCounts = new HashMap<>();
        Map<String, Long> pathGroupCounts = new HashMap<>();
        Map<String, Long> pathGroupCrawlActivity = new HashMap<>();

        for (Endpoint ep : endpoints) {
            int depth = computePathDepth(ep.getUrl(), ep.getRoot().getBaseUrl());
            depthCounts.merge(depth, 1L, Long::sum);

            String rootName = ep.getRoot().getName();
            rootCounts.merge(rootName, 1L, Long::sum);

            String group = computePathGroup(ep.getUrl(), ep.getRoot().getBaseUrl(), 2);
            if (group != null && !group.isBlank()) {
                pathGroupCounts.merge(group, 1L, Long::sum);
                if (ep.getTotalCrawls() > 0) {
                    pathGroupCrawlActivity.merge(group, (long) ep.getTotalCrawls(), Long::sum);
                }
            }
        }

        List<Root> roots = rootId != null
                ? rootRepository.findById(rootId).map(List::of).orElse(List.of())
                : rootRepository.findAll();

        List<RootEndpointAnalyticsDto> rootAnalytics = roots.stream()
                .map(root -> buildRootAnalytics(root, endpoints))
                .sorted(Comparator.comparing(RootEndpointAnalyticsDto::rootName))
                .toList();

        return new EndpointAnalyticsResponse(
                endpoints.size(),
                active,
                disabled,
                toDepthLabelCounts(depthCounts),
                toStringLabelCounts(rootCounts),
                topLabels(pathGroupCounts, 10),
                topLabels(pathGroupCrawlActivity, 10),
                rootAnalytics
        );
    }

    private RootEndpointAnalyticsDto buildRootAnalytics(Root root, List<Endpoint> allEndpoints) {
        List<Endpoint> rootEps = allEndpoints.stream()
                .filter(e -> e.getRoot().getId().equals(root.getId()))
                .toList();

        long active = rootEps.stream().filter(e -> e.getStatus() == RecordStatus.ACTIVE).count();
        long disabled = rootEps.size() - active;

        double avgDepth = rootEps.isEmpty() ? 0.0
                : rootEps.stream()
                        .mapToInt(e -> computePathDepth(e.getUrl(), root.getBaseUrl()))
                        .average()
                        .orElse(0.0);

        Instant lastAdded = rootEps.stream()
                .map(Endpoint::getCreatedAt)
                .max(Instant::compareTo)
                .orElse(null);

        long crawled = rootEps.stream().filter(e -> e.getTotalCrawls() > 0).count();
        long neverCrawled = rootEps.size() - crawled;
        double successRate = rootEps.isEmpty() ? 0.0 : (double) crawled / rootEps.size() * 100.0;
        double failureRate = rootEps.isEmpty() ? 0.0 : (double) neverCrawled / rootEps.size() * 100.0;

        return new RootEndpointAnalyticsDto(
                root.getId(),
                root.getName(),
                rootEps.size(),
                active,
                disabled,
                Math.round(avgDepth * 10.0) / 10.0,
                lastAdded,
                Math.round(successRate * 10.0) / 10.0,
                Math.round(failureRate * 10.0) / 10.0
        );
    }

    private List<LabelCountDto> toDepthLabelCounts(Map<Integer, Long> counts) {
        return counts.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(e -> new LabelCountDto("Depth " + e.getKey(), e.getValue()))
                .collect(Collectors.toList());
    }

    private List<LabelCountDto> toStringLabelCounts(Map<String, Long> counts) {
        return counts.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(e -> new LabelCountDto(e.getKey(), e.getValue()))
                .collect(Collectors.toList());
    }

    private List<LabelCountDto> topLabels(Map<String, Long> counts, int limit) {
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(limit)
                .map(e -> new LabelCountDto(e.getKey(), e.getValue()))
                .collect(Collectors.toList());
    }

    static int computePathDepth(String url, String baseUrl) {
        try {
            URI uri = URI.create(url);
            String path = normalizePath(uri.getPath());
            String basePath = "/";
            if (baseUrl != null && !baseUrl.isBlank()) {
                basePath = normalizePath(URI.create(baseUrl).getPath());
            }
            String relative = path;
            if (!"/".equals(basePath) && path.startsWith(basePath)) {
                relative = path.substring(basePath.length());
                if (relative.isEmpty()) relative = "/";
            }
            if ("/".equals(relative)) return 0;
            return (int) relative.chars().filter(ch -> ch == '/').count() + 1;
        } catch (Exception ex) {
            return 0;
        }
    }

    static String computePathGroup(String url, String baseUrl, int segmentCount) {
        if (segmentCount <= 0) return null;
        try {
            URI uri = URI.create(url);
            String path = normalizePath(uri.getPath());
            String basePath = "/";
            if (baseUrl != null && !baseUrl.isBlank()) {
                basePath = normalizePath(URI.create(baseUrl).getPath());
            }
            String relative = path;
            if (!"/".equals(basePath) && path.startsWith(basePath)) {
                relative = path.substring(basePath.length());
            }
            String[] segments = relative.split("/");
            List<String> parts = new ArrayList<>();
            for (String seg : segments) {
                if (seg != null && !seg.isBlank()) {
                    parts.add(seg);
                }
                if (parts.size() >= segmentCount) break;
            }
            return parts.isEmpty() ? "(root)" : String.join("/", parts);
        } catch (Exception ex) {
            return null;
        }
    }

    private static String normalizePath(String path) {
        if (path == null || path.isBlank()) return "/";
        String p = path.endsWith("/") && path.length() > 1 ? path.substring(0, path.length() - 1) : path;
        return p.isEmpty() ? "/" : p;
    }

    @Transactional
    public EndpointResponse updateCrawlStats(Long id, int articlesFound) {
        Endpoint endpoint = findEndpoint(id);
        double alpha = 0.3;
        double newScore = alpha * articlesFound + (1.0 - alpha) * endpoint.getCrawlScore();
        endpoint.setCrawlScore(newScore);
        endpoint.setLastCrawledAt(java.time.Instant.now());
        endpoint.setTotalCrawls(endpoint.getTotalCrawls() + 1);
        return toResponse(endpointRepository.save(endpoint));
    }

    private EndpointResponse toResponse(Endpoint endpoint) {
        return new EndpointResponse(
                endpoint.getId(),
                endpoint.getUrl(),
                endpoint.getRoot().getId(),
                endpoint.getStatus().name(),
                endpoint.getStatus() == RecordStatus.ACTIVE,
                endpoint.getCreatedAt(),
                endpoint.getCrawlScore(),
                endpoint.getLastCrawledAt(),
                endpoint.getTotalCrawls()
        );
    }
}
