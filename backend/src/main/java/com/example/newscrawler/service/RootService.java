package com.example.newscrawler.service;

import java.util.List;
import java.util.Locale;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.example.newscrawler.dto.CreateRootRequest;
import com.example.newscrawler.dto.RootResponse;
import com.example.newscrawler.entity.RecordStatus;
import com.example.newscrawler.entity.Root;
import com.example.newscrawler.repository.EndpointRepository;
import com.example.newscrawler.repository.RootRepository;

@Service
public class RootService {

    private final RootRepository rootRepository;
    private final EndpointRepository endpointRepository;
    private final EndpointService endpointService;

    public RootService(
            RootRepository rootRepository,
            EndpointRepository endpointRepository,
            EndpointService endpointService
    ) {
        this.rootRepository = rootRepository;
        this.endpointRepository = endpointRepository;
        this.endpointService = endpointService;
    }

    public RootResponse create(CreateRootRequest request) {
        Root root = new Root();
        root.setName(request.name());
        root.setBaseUrl(request.baseUrl());
        root.setStatus(RecordStatus.ACTIVE);
        Root saved = rootRepository.save(root);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<RootResponse> findAll(String search, String status) {
        RecordStatus parsedStatus = parseStatus(status);
        String normalizedSearch = search == null ? "" : search.trim();

        List<Root> roots;
        if (parsedStatus != null) {
            roots = rootRepository.findByStatusAndNameContainingIgnoreCaseOrStatusAndBaseUrlContainingIgnoreCase(
                    parsedStatus,
                    normalizedSearch,
                    parsedStatus,
                    normalizedSearch
            );
        } else if (!normalizedSearch.isEmpty()) {
            roots = rootRepository.findByNameContainingIgnoreCaseOrBaseUrlContainingIgnoreCase(normalizedSearch, normalizedSearch);
        } else {
            roots = rootRepository.findAll();
        }

        return roots.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public RootResponse findById(Long id) {
        return toResponse(findRoot(id));
    }

    public RootResponse update(Long id, CreateRootRequest request) {
        Root root = findRoot(id);
        root.setName(request.name());
        root.setBaseUrl(request.baseUrl());
        return toResponse(rootRepository.save(root));
    }

    @Transactional
    public RootResponse updateStatus(Long id, String status) {
        Root root = findRoot(id);
        RecordStatus parsedStatus = parseRequiredStatus(status);
        root.setStatus(parsedStatus);

        if (parsedStatus == RecordStatus.SUSPENDED) {
            endpointRepository.findByRootId(id).forEach(endpoint -> endpoint.setStatus(RecordStatus.SUSPENDED));
        }
        return toResponse(rootRepository.save(root));
    }

    @Transactional
    public void delete(Long id, boolean hardDelete) {
        if (!rootRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Root not found");
        }

        if (!hardDelete) {
            updateStatus(id, RecordStatus.SUSPENDED.name());
            return;
        }

        java.util.List<Long> endpointIds = endpointRepository.findByRootId(id)
                .stream()
                .map(e -> e.getId())
                .toList();

        for (Long endpointId : endpointIds) {
            endpointService.delete(endpointId, true);
        }

        rootRepository.deleteById(id);
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

    private Root findRoot(Long id) {
        return rootRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Root not found"));
    }

    private RootResponse toResponse(Root root) {
        return new RootResponse(
                root.getId(),
                root.getName(),
                root.getBaseUrl(),
                root.getStatus().name(),
                root.getStatus() == RecordStatus.ACTIVE,
                root.getCreatedAt()
        );
    }
}
