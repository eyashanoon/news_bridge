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
    private final RestTemplate restTemplate;

    @Value("${wayback.api.cdx-url:https://web.archive.org/cdx/search/cdx}")
    private String waybackCdxUrl;

    @Value("${endpoint-discovery.server.base-url:http://localhost:8004}")
    private String discoveryBaseUrl;

    @Value("${endpoint-discovery.max-depth:2}")
    private int discoveryMaxDepth;

    public RootDiscoveryService(
            RootRepository rootRepository,
            EndpointService endpointService,
            EndpointRepository endpointRepository
    ) {
        this.rootRepository = rootRepository;
        this.endpointService = endpointService;
        this.endpointRepository = endpointRepository;
        // 5 s connect, 15 s read (async jobs return quickly; polling uses short reads)
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);
        factory.setReadTimeout(15_000);
        this.restTemplate = new RestTemplate(factory);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Trust verification: Wayback Machine (reliability) + Wikidata (bias)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Two-signal trust verification:
     *  1. Wayback Machine CDX API  → domain age → reliabilityScore
     *  2. Wikidata SPARQL endpoint → editorial stance (P1142) → biasLabel
     *     + Wikidata presence adds a +10 trust bonus for verified notable orgs
     */
    public NewsGuardVerifyResponse verify(Long rootId) {
        Root root = findRoot(rootId);
        String siteUrl = root.getBaseUrl();

        // Extract bare domain (strip scheme, www., path)
        String domain;
        try {
            java.net.URI parsed = new java.net.URI(siteUrl);
            domain = parsed.getHost();
            if (domain == null || domain.isBlank()) {
                domain = siteUrl;
            } else if (domain.startsWith("www.")) {
                domain = domain.substring(4);
            }
        } catch (Exception e) {
            domain = siteUrl;
        }
        // Sanitise for inclusion in SPARQL string literal
        final String safeDomain = domain.replaceAll("[^a-zA-Z0-9.\\-]", "");

        // ── Signal 1: Wayback Machine CDX ──────────────────────────────────
        int domainAgeYears = 0;
        int reliabilityScore = 0;
        boolean inWayback = false;
        int captureYear = 0;

        try {
            String cdxUri = UriComponentsBuilder
                    .fromHttpUrl(waybackCdxUrl)
                    .queryParam("url", safeDomain)
                    .queryParam("output", "json")
                    .queryParam("limit", "1")
                    .queryParam("fl", "timestamp")
                    .queryParam("filter", "statuscode:200")
                    .queryParam("from", "19900101")
                    .build()
                    .toUriString();

            ResponseEntity<List> cdxResp = restTemplate.getForEntity(cdxUri, List.class);
            List<?> cdxBody = cdxResp.getBody();

            // Response: [["timestamp"],["19961218230554"]] or [["timestamp"]] if none
            if (cdxBody != null && cdxBody.size() >= 2) {
                List<?> row = (List<?>) cdxBody.get(1);
                String ts = row.get(0).toString();
                captureYear = Integer.parseInt(ts.substring(0, 4));
                domainAgeYears = Math.max(0, java.time.Year.now().getValue() - captureYear);
                reliabilityScore = toReliabilityScore(domainAgeYears);
                inWayback = true;
            }
        } catch (RestClientException ex) {
            log.warn("Wayback CDX call failed for {}: {}", safeDomain, ex.getMessage());
        }

        // ── Signal 2: Wikidata SPARQL → editorial stance / bias ────────────
        String biasLabel = "Unknown";
        boolean inWikidata = false;

        try {
            // P856 = official website, P1142 = political ideology / editorial stance
            String sparql =
                    "SELECT ?stanceLabel WHERE { " +
                    "?item wdt:P856 ?url. " +
                    "FILTER(CONTAINS(LCASE(STR(?url)), '" + safeDomain + "')) " +
                    "OPTIONAL { ?item wdt:P1142 ?stance. } " +
                    "SERVICE wikibase:label { bd:serviceParam wikibase:language \"en\". } " +
                    "} LIMIT 5";

            String sparqlUri = UriComponentsBuilder
                    .fromHttpUrl("https://query.wikidata.org/sparql")
                    .queryParam("query", sparql)
                    .queryParam("format", "json")
                    .build()
                    .toUriString();

            HttpHeaders wdHeaders = new HttpHeaders();
            wdHeaders.set("Accept", "application/sparql-results+json");
            wdHeaders.set("User-Agent", "NewsCrawlerTrustBot/1.0 (trust-verification)");

            ResponseEntity<Map> wdResp = restTemplate.exchange(
                    sparqlUri, HttpMethod.GET, new HttpEntity<>(wdHeaders), Map.class);
            Map<?, ?> wdBody = wdResp.getBody();

            if (wdBody != null) {
                Map<?, ?> results = (Map<?, ?>) wdBody.get("results");
                if (results != null) {
                    List<?> bindings = (List<?>) results.get("bindings");
                    if (bindings != null && !bindings.isEmpty()) {
                        inWikidata = true;
                        for (Object b : bindings) {
                            Map<?, ?> binding = (Map<?, ?>) b;
                            Map<?, ?> slMap = (Map<?, ?>) binding.get("stanceLabel");
                            if (slMap != null) {
                                biasLabel = mapStanceToLabel(slMap.get("value").toString());
                                break;
                            }
                        }
                        // Listed in Wikidata but no P1142 → notable org with no partisan slant recorded
                        if ("Unknown".equals(biasLabel)) biasLabel = "Center";
                    }
                }
            }
        } catch (RestClientException ex) {
            log.warn("Wikidata SPARQL call failed for {}: {}", safeDomain, ex.getMessage());
        }

        // ── Combine signals ────────────────────────────────────────────────
        if (!inWayback && !inWikidata) {
            return new NewsGuardVerifyResponse(false, 0, 0, 0,
                    "Unknown", "NOT FOUND",
                    "Domain not found in Wayback Machine or Wikidata");
        }

        // Wikidata presence = verified notable organisation → +10 trust bonus
        int trustScore = Math.min(100, reliabilityScore + (inWikidata ? 10 : 0));
        String trustLabel = toTrustLabel(domainAgeYears, inWikidata);

        String ageStr = inWayback
                ? "active since " + captureYear + " (" + domainAgeYears + " yr" + (domainAgeYears != 1 ? "s" : "") + ")"
                : "not in Wayback Machine";
        String wdStr  = inWikidata ? " · verified on Wikidata" : "";
        String description = "Domain " + ageStr + wdStr;

        return new NewsGuardVerifyResponse(true, domainAgeYears,
                trustScore, reliabilityScore, biasLabel, trustLabel, description);
    }

    // ── Scoring helpers ────────────────────────────────────────────────────

    private static int toReliabilityScore(int ageYears) {
        if (ageYears == 0)  return 0;
        if (ageYears < 2)   return 20;
        if (ageYears < 5)   return 40;
        if (ageYears < 10)  return 60;
        if (ageYears < 20)  return 80;
        return 90;
    }

    private static String toTrustLabel(int ageYears, boolean inWikidata) {
        if (!inWikidata && ageYears < 2)  return "NEW SITE";
        if (!inWikidata && ageYears < 5)  return "EMERGING";
        if (ageYears < 10)                return "ESTABLISHED";
        if (ageYears < 20)                return "PROMINENT";
        return "MAJOR SOURCE";
    }

    private static String mapStanceToLabel(String raw) {
        if (raw == null) return "Unknown";
        String s = raw.toLowerCase();
        if (s.contains("far-left")  || s.contains("far left")   || s.contains("extreme left"))   return "Far Left";
        if (s.contains("left-wing") || s.contains("leftist")    || s.contains("progressive"))    return "Left";
        if (s.contains("centre-left") || s.contains("center-left"))                               return "Center-Left";
        if (s.contains("centrist")  || s.contains("centrism")   || s.contains("centre") || s.contains("center")) return "Center";
        if (s.contains("centre-right") || s.contains("center-right"))                             return "Center-Right";
        if (s.contains("right-wing") || s.contains("rightist")  || s.contains("conservat"))      return "Right";
        if (s.contains("far-right") || s.contains("far right")  || s.contains("extreme right"))  return "Far Right";
        return "Unknown";
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
