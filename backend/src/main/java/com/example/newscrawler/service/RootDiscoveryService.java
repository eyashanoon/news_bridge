package com.example.newscrawler.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.util.UriComponentsBuilder;

import com.example.newscrawler.dto.BulkSaveEndpointsRequest;
import com.example.newscrawler.dto.CreateEndpointRequest;
import com.example.newscrawler.dto.EndpointResponse;
import com.example.newscrawler.dto.NewsGuardVerifyResponse;
import com.example.newscrawler.entity.Root;
import com.example.newscrawler.repository.EndpointRepository;
import com.example.newscrawler.repository.RootRepository;

@Service
public class RootDiscoveryService {

    private static final Logger log = LoggerFactory.getLogger(RootDiscoveryService.class);

    private final RootRepository rootRepository;
    private final EndpointService endpointService;
    private final EndpointRepository endpointRepository;
    private final RootVerificationService rootVerificationService;
    private final RestTemplate restTemplate;

    @Value("${endpoint-discovery.server.base-url:http://localhost:8004}")
    private String discoveryBaseUrl;

    @Value("${endpoint-discovery.max-depth:2}")
    private int discoveryMaxDepth;

    public RootDiscoveryService(
            RootRepository rootRepository,
            EndpointService endpointService,
            EndpointRepository endpointRepository,
            RootVerificationService rootVerificationService
    ) {
        this.rootRepository = rootRepository;
        this.endpointService = endpointService;
        this.endpointRepository = endpointRepository;
        this.rootVerificationService = rootVerificationService;
        // 5 s connect, 15 s read (async jobs return quickly; polling uses short reads)
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);
        factory.setReadTimeout(15_000);
        this.restTemplate = new RestTemplate(factory);
    }

    /** Multi-source trust verification via open evaluation APIs and datasets. */
    public NewsGuardVerifyResponse verify(Long rootId) {
        Root root = findRoot(rootId);
        return rootVerificationService.verify(root);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Endpoint discovery via Python service
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Starts an async discovery job on the Python service.
     * Returns job metadata including job_id for polling.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> startDiscovery(Long rootId) {
        Root root = findRoot(rootId);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("root_url", root.getBaseUrl());
        requestBody.put("max_depth", discoveryMaxDepth);

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    discoveryBaseUrl + "/discover/start",
                    HttpMethod.POST,
                    new HttpEntity<>(requestBody, headers),
                    Map.class
            );

            Map<String, Object> result = (Map<String, Object>) response.getBody();
            if (result == null) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "Discovery service returned empty response.");
            }
            result.put("rootId", rootId);
            result.put("rootUrl", root.getBaseUrl());
            result.put("rootName", root.getName());
            return result;

        } catch (RestClientException ex) {
            log.error("Discovery start failed for root {}: {}", rootId, ex.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Endpoint discovery service is unavailable: " + ex.getMessage());
        }
    }

    /**
     * Assesses whether a single URL is a crawlable article-listing endpoint.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> assessEndpoint(Long rootId, String url) {
        Root root = findRoot(rootId);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("url", url);
        requestBody.put("root_url", root.getBaseUrl());

        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    discoveryBaseUrl + "/assess/endpoint",
                    HttpMethod.POST,
                    new HttpEntity<>(requestBody, headers),
                    Map.class
            );

            Map<String, Object> result = (Map<String, Object>) response.getBody();
            if (result == null) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "Discovery service returned empty response.");
            }
            return result;

        } catch (RestClientException ex) {
            log.error("Endpoint assessment failed for root {} url {}: {}", rootId, url, ex.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Endpoint discovery service is unavailable: " + ex.getMessage());
        }
    }

    /**
     * Polls a running or completed discovery job for new logs and the final result.
     */
    @SuppressWarnings("unchecked")
    public Map<String, Object> pollDiscoveryJob(String jobId, int logOffset) {
        try {
            String uri = UriComponentsBuilder
                    .fromHttpUrl(discoveryBaseUrl + "/discover/jobs/" + jobId)
                    .queryParam("log_offset", logOffset)
                    .build()
                    .toUriString();

            ResponseEntity<Map> response = restTemplate.exchange(
                    uri,
                    HttpMethod.GET,
                    HttpEntity.EMPTY,
                    Map.class
            );

            Map<String, Object> result = (Map<String, Object>) response.getBody();
            if (result == null) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                        "Discovery service returned empty response.");
            }
            return result;

        } catch (RestClientException ex) {
            log.error("Discovery poll failed for job {}: {}", jobId, ex.getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Endpoint discovery service is unavailable: " + ex.getMessage());
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Bulk-save discovered endpoints
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Saves a list of URLs as endpoints linked to the given root.
     * URLs that already exist in the database are silently skipped.
     */
    public List<EndpointResponse> bulkSave(Long rootId, BulkSaveEndpointsRequest request) {
        findRoot(rootId); // existence check

        List<EndpointResponse> saved = new ArrayList<>();
        for (String url : request.urls()) {
            if (url == null || url.isBlank()) continue;

            // Skip duplicates already in DB
            if (endpointRepository.existsByUrl(url)) {
                log.debug("Endpoint already exists, skipping: {}", url);
                continue;
            }

            try {
                EndpointResponse ep = endpointService.create(
                        new CreateEndpointRequest(url, rootId)
                );
                saved.add(ep);
            } catch (ResponseStatusException ex) {
                // CONFLICT (already exists) is safe to skip
                if (ex.getStatusCode() == HttpStatus.CONFLICT) {
                    log.debug("Endpoint conflict (race), skipping: {}", url);
                } else {
                    log.warn("Failed to save endpoint {}: {}", url, ex.getMessage());
                }
            }
        }
        return saved;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private Root findRoot(Long id) {
        return rootRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Root not found"));
    }

}
