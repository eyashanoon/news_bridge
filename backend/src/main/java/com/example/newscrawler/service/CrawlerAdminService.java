package com.example.newscrawler.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

import static org.springframework.http.HttpStatus.BAD_GATEWAY;

@Service
public class CrawlerAdminService {

    private final RestTemplate restTemplate = new RestTemplate();
    private final String crawlerBaseUrl;

    public CrawlerAdminService(@Value("${crawler.server.base-url:http://127.0.0.1:8000}") String crawlerBaseUrl) {
        this.crawlerBaseUrl = crawlerBaseUrl.endsWith("/")
                ? crawlerBaseUrl.substring(0, crawlerBaseUrl.length() - 1)
                : crawlerBaseUrl;
    }

    public Map<String, Object> health() {
        return get("/health");
    }

    public Map<String, Object> lastRun() {
        return get("/last-run");
    }

    public Map<String, Object> schedulerStatus() {
        return get("/control/status");
    }

    public Map<String, Object> runNow() {
        return post("/run-now");
    }

    public Map<String, Object> startScheduler() {
        return post("/control/start");
    }

    public Map<String, Object> stopScheduler() {
        return post("/control/stop");
    }

    private Map<String, Object> get(String path) {
        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    crawlerBaseUrl + path,
                    HttpMethod.GET,
                    HttpEntity.EMPTY,
                    Map.class
            );
            return response.getBody();
        } catch (HttpStatusCodeException ex) {
            throw new ResponseStatusException(BAD_GATEWAY, "Crawler service error: " + ex.getResponseBodyAsString());
        } catch (Exception ex) {
            throw new ResponseStatusException(BAD_GATEWAY, "Crawler service unavailable: " + ex.getMessage());
        }
    }

    public Map<String, Object> getLogs(String since, int limit) {
        String url = crawlerBaseUrl + "/logs?limit=" + limit + (since != null ? "&since=" + since : "");
        try {
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, HttpEntity.EMPTY, Map.class);
            return response.getBody();
        } catch (HttpStatusCodeException ex) {
            throw new ResponseStatusException(BAD_GATEWAY, "Crawler service error: " + ex.getResponseBodyAsString());
        } catch (Exception ex) {
            throw new ResponseStatusException(BAD_GATEWAY, "Crawler service unavailable: " + ex.getMessage());
        }
    }

    public Map<String, Object> deleteLogs() {
        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    crawlerBaseUrl + "/logs", HttpMethod.DELETE, HttpEntity.EMPTY, Map.class);
            return response.getBody();
        } catch (HttpStatusCodeException ex) {
            throw new ResponseStatusException(BAD_GATEWAY, "Crawler service error: " + ex.getResponseBodyAsString());
        } catch (Exception ex) {
            throw new ResponseStatusException(BAD_GATEWAY, "Crawler service unavailable: " + ex.getMessage());
        }
    }

    public Map<String, Object> setInterval(int minutes) {
        return postWithBody("/control/interval", Map.of("minutes", minutes));
    }

    private Map<String, Object> post(String path) {
        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    crawlerBaseUrl + path,
                    HttpMethod.POST,
                    HttpEntity.EMPTY,
                    Map.class
            );
            return response.getBody();
        } catch (HttpStatusCodeException ex) {
            throw new ResponseStatusException(BAD_GATEWAY, "Crawler service error: " + ex.getResponseBodyAsString());
        } catch (Exception ex) {
            throw new ResponseStatusException(BAD_GATEWAY, "Crawler service unavailable: " + ex.getMessage());
        }
    }

    private Map<String, Object> postWithBody(String path, Object body) {
        try {
            org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
            headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
            HttpEntity<Object> entity = new HttpEntity<>(body, headers);
            ResponseEntity<Map> response = restTemplate.exchange(
                    crawlerBaseUrl + path, HttpMethod.POST, entity, Map.class);
            return response.getBody();
        } catch (HttpStatusCodeException ex) {
            throw new ResponseStatusException(BAD_GATEWAY, "Crawler service error: " + ex.getResponseBodyAsString());
        } catch (Exception ex) {
            throw new ResponseStatusException(BAD_GATEWAY, "Crawler service unavailable: " + ex.getMessage());
        }
    }
}
