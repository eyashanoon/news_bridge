package com.example.newscrawler.service;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.example.newscrawler.dto.CacheEndpointResponse;
import com.example.newscrawler.dto.CreateCacheEndpointRequest;
import com.example.newscrawler.entity.CacheEndpoint;
import com.example.newscrawler.entity.Endpoint;
import com.example.newscrawler.repository.CacheEndpointRepository;
import com.example.newscrawler.repository.EndpointRepository;

@Service
public class CacheEndpointService {

    @Autowired
    private CacheEndpointRepository cacheEndpointRepository;

    @Autowired
    private EndpointRepository endpointRepository;

    public CacheEndpointResponse create(CreateCacheEndpointRequest request) {
        if (cacheEndpointRepository.existsBySourceEndpointIdAndUrl(request.sourceEndpointId(), request.url())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Cache endpoint with URL already exists for this source endpoint"
            );
        }

        Endpoint sourceEndpoint = endpointRepository.findById(request.sourceEndpointId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Source endpoint not found"));

        CacheEndpoint cacheEndpoint = new CacheEndpoint();
        cacheEndpoint.setUrl(request.url());
        cacheEndpoint.setResult(request.result());
        cacheEndpoint.setExtractedText(request.extractedText());
        cacheEndpoint.setExtractedTitle(request.extractedTitle());
        cacheEndpoint.setExtractedContentJson(request.extractedContentJson());
        cacheEndpoint.setDomPattern(request.domPattern());
        cacheEndpoint.setSourceEndpoint(sourceEndpoint);
        cacheEndpoint.setAnalyzedAt(LocalDateTime.now());

        return toResponse(cacheEndpointRepository.save(cacheEndpoint));
    }

    @Transactional(readOnly = true)
    public CacheEndpointResponse findBySourceEndpointAndUrl(Long sourceEndpointId, String url) {
        // Use ordered query to handle duplicates by picking the latest
        var results = cacheEndpointRepository.findBySourceEndpointIdAndUrlOrderByCreatedAtDesc(sourceEndpointId, url);
        if (results.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Cache endpoint not found");
        }
        return toResponse(results.get(0));
    }

    @Transactional(readOnly = true)
    public List<CacheEndpointResponse> findBySourceEndpointId(Long endpointId) {
        endpointRepository.findById(endpointId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Endpoint not found"));

        return cacheEndpointRepository.findBySourceEndpointId(endpointId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<CacheEndpointResponse> findAll() {
        return cacheEndpointRepository.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public CacheEndpointResponse findById(Long id) {
        return toResponse(cacheEndpointRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cache endpoint not found")));
    }

    public CacheEndpointResponse update(Long id, CreateCacheEndpointRequest request) {
        CacheEndpoint cacheEndpoint = cacheEndpointRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Cache endpoint not found"));

        if (!cacheEndpoint.getUrl().equals(request.url())
                && cacheEndpointRepository.existsBySourceEndpointIdAndUrl(request.sourceEndpointId(), request.url())) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Cache endpoint with URL already exists for this source endpoint"
            );
        }

        Endpoint sourceEndpoint = endpointRepository.findById(request.sourceEndpointId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Source endpoint not found"));

        cacheEndpoint.setUrl(request.url());
        cacheEndpoint.setResult(request.result());
        cacheEndpoint.setExtractedText(request.extractedText());
        cacheEndpoint.setExtractedTitle(request.extractedTitle());
        cacheEndpoint.setExtractedContentJson(request.extractedContentJson());
        cacheEndpoint.setDomPattern(request.domPattern());
        cacheEndpoint.setSourceEndpoint(sourceEndpoint);

        return toResponse(cacheEndpointRepository.save(cacheEndpoint));
    }

    public void delete(Long id) {
        if (!cacheEndpointRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Cache endpoint not found");
        }
        cacheEndpointRepository.deleteById(id);
    }

    private CacheEndpointResponse toResponse(CacheEndpoint cacheEndpoint) {
        return new CacheEndpointResponse(
                cacheEndpoint.getId(),
                cacheEndpoint.getUrl(),
                cacheEndpoint.getResult(),
                cacheEndpoint.getExtractedText(),
            cacheEndpoint.getExtractedTitle(),
            cacheEndpoint.getExtractedContentJson(),
                cacheEndpoint.getDomPattern(),
                cacheEndpoint.getSourceEndpoint().getId(),
                cacheEndpoint.getAnalyzedAt(),
                cacheEndpoint.getCreatedAt()
        );
    }
}
