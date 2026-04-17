package com.example.newscrawler.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

import static org.springframework.http.HttpStatus.BAD_GATEWAY;

@Service
public class TelegramCrawlerAdminService {

    private final RestTemplate restTemplate = new RestTemplate();
    private final String baseUrl;

    public TelegramCrawlerAdminService(
            @Value("${telegram-crawler.server.base-url:http://localhost:8001}") String baseUrl) {
        this.baseUrl = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
    }

    public Map<String, Object> health()           { return get("/health"); }
    public Map<String, Object> lastRun()           { return get("/last-run"); }
    public Map<String, Object> schedulerStatus()   { return get("/control/status"); }
    public Map<String, Object> runNow()            { return post("/run-now"); }
    public Map<String, Object> startScheduler()    { return post("/control/start"); }
    public Map<String, Object> stopScheduler()     { return post("/control/stop"); }

    public Map<String, Object> getLogs(String since, int limit) {
        String url = baseUrl + "/logs?limit=" + limit + (since != null ? "&since=" + since : "");
        try {
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, HttpEntity.EMPTY, Map.class);
            return response.getBody();
        } catch (HttpStatusCodeException ex) {
            throw new ResponseStatusException(BAD_GATEWAY, "Telegram crawler error: " + ex.getResponseBodyAsString());
        } catch (Exception ex) {
            throw new ResponseStatusException(BAD_GATEWAY, "Telegram crawler unavailable: " + ex.getMessage());
        }
    }

    public Map<String, Object> deleteLogs() {
        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    baseUrl + "/logs", HttpMethod.DELETE, HttpEntity.EMPTY, Map.class);
            return response.getBody();
        } catch (HttpStatusCodeException ex) {
            throw new ResponseStatusException(BAD_GATEWAY, "Telegram crawler error: " + ex.getResponseBodyAsString());
        } catch (Exception ex) {
            throw new ResponseStatusException(BAD_GATEWAY, "Telegram crawler unavailable: " + ex.getMessage());
        }
    }

    public Map<String, Object> setInterval(int minutes) {
        return postWithBody("/control/interval", Map.of("minutes", minutes));
    }

    public Map<String, Object> searchChannels(String query) {
        String url = baseUrl + "/search?q=" + java.net.URLEncoder.encode(query, java.nio.charset.StandardCharsets.UTF_8);
        try {
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.GET, HttpEntity.EMPTY, Map.class);
            return response.getBody();
        } catch (HttpStatusCodeException ex) {
            throw new ResponseStatusException(BAD_GATEWAY, "Telegram crawler error: " + ex.getResponseBodyAsString());
        } catch (Exception ex) {
            throw new ResponseStatusException(BAD_GATEWAY, "Telegram crawler unavailable: " + ex.getMessage());
        }
    }

    private Map<String, Object> get(String path) {
        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    baseUrl + path, HttpMethod.GET, HttpEntity.EMPTY, Map.class);
            return response.getBody();
        } catch (HttpStatusCodeException ex) {
            throw new ResponseStatusException(BAD_GATEWAY, "Telegram crawler error: " + ex.getResponseBodyAsString());
        } catch (Exception ex) {
            throw new ResponseStatusException(BAD_GATEWAY, "Telegram crawler unavailable: " + ex.getMessage());
        }
    }

    private Map<String, Object> post(String path) {
        try {
            ResponseEntity<Map> response = restTemplate.exchange(
                    baseUrl + path, HttpMethod.POST, HttpEntity.EMPTY, Map.class);
            return response.getBody();
        } catch (HttpStatusCodeException ex) {
            throw new ResponseStatusException(BAD_GATEWAY, "Telegram crawler error: " + ex.getResponseBodyAsString());
        } catch (Exception ex) {
            throw new ResponseStatusException(BAD_GATEWAY, "Telegram crawler unavailable: " + ex.getMessage());
        }
    }

    private Map<String, Object> postWithBody(String path, Object body) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Object> entity = new HttpEntity<>(body, headers);
            ResponseEntity<Map> response = restTemplate.exchange(
                    baseUrl + path, HttpMethod.POST, entity, Map.class);
            return response.getBody();
        } catch (HttpStatusCodeException ex) {
            throw new ResponseStatusException(BAD_GATEWAY, "Telegram crawler error: " + ex.getResponseBodyAsString());
        } catch (Exception ex) {
            throw new ResponseStatusException(BAD_GATEWAY, "Telegram crawler unavailable: " + ex.getMessage());
        }
    }
}
