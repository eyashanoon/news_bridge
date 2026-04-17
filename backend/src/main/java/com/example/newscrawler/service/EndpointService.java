package com.example.newscrawler.service;

import java.util.List;
import java.util.Locale;
import java.net.URI;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.example.newscrawler.dto.CreateEndpointRequest;
import com.example.newscrawler.dto.EndpointResponse;
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

    public EndpointService(
            EndpointRepository endpointRepository,
            RootRepository rootRepository,
            ArticleRepository articleRepository,
            CacheEndpointRepository cacheEndpointRepository
    ) {
        this.endpointRepository = endpointRepository;
        this.rootRepository = rootRepository;
        this.articleRepository = articleRepository;
        this.cacheEndpointRepository = cacheEndpointRepository;
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
        return toResponse(endpointRepository.save(endpoint));
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

    private EndpointResponse toResponse(Endpoint endpoint) {
        return new EndpointResponse(
                endpoint.getId(),
                endpoint.getUrl(),
                endpoint.getRoot().getId(),
                endpoint.getStatus().name(),
                endpoint.getStatus() == RecordStatus.ACTIVE,
                endpoint.getCreatedAt()
        );
    }
}
