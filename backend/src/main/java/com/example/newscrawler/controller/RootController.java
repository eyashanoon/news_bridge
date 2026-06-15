package com.example.newscrawler.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.example.newscrawler.dto.AssessEndpointRequest;
import com.example.newscrawler.dto.BulkSaveEndpointsRequest;
import com.example.newscrawler.dto.CreateRootRequest;
import com.example.newscrawler.dto.EndpointResponse;
import com.example.newscrawler.dto.NewsGuardVerifyResponse;
import com.example.newscrawler.dto.RootResponse;
import com.example.newscrawler.dto.UpdateRecordStatusRequest;
import com.example.newscrawler.service.RootDiscoveryService;
import com.example.newscrawler.service.RootService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/roots")
public class RootController {

    private final RootService rootService;
    private final RootDiscoveryService rootDiscoveryService;

    public RootController(RootService rootService, RootDiscoveryService rootDiscoveryService) {
        this.rootService = rootService;
        this.rootDiscoveryService = rootDiscoveryService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RootResponse create(@Valid @RequestBody CreateRootRequest request) {
        return rootService.create(request);
    }

    @GetMapping
    public List<RootResponse> listAll(
            @org.springframework.web.bind.annotation.RequestParam(required = false) String search,
            @org.springframework.web.bind.annotation.RequestParam(required = false) String status
    ) {
        return rootService.findAll(search, status);
    }

    @GetMapping("/{id}")
    public RootResponse getById(@PathVariable Long id) {
        return rootService.findById(id);
    }

    @PutMapping("/{id}")
    public RootResponse update(@PathVariable Long id, @Valid @RequestBody CreateRootRequest request) {
        return rootService.update(id, request);
    }

    @PutMapping("/{id}/status")
    public RootResponse updateStatus(@PathVariable Long id, @RequestBody UpdateRecordStatusRequest request) {
        return rootService.updateStatus(id, request.status());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @org.springframework.web.bind.annotation.RequestParam(defaultValue = "false") boolean hard) {
        rootService.delete(id, hard);
    }

    // ── Discovery tools ────────────────────────────────────────────────────

    /** Verify site credibility via open-source evaluation APIs and datasets. */
    @PostMapping("/{id}/verify")
    public NewsGuardVerifyResponse verify(@PathVariable Long id) {
        return rootDiscoveryService.verify(id);
    }

    /** Start async BFS endpoint discovery against the Python discovery service. */
    @PostMapping("/{id}/discover")
    public Map<String, Object> startDiscover(@PathVariable Long id) {
        return rootDiscoveryService.startDiscovery(id);
    }

    /** Poll a discovery job for live logs and the final result. */
    @GetMapping("/{id}/discover/jobs/{jobId}")
    public Map<String, Object> pollDiscoverJob(
            @PathVariable Long id,
            @PathVariable String jobId,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "0") int logOffset
    ) {
        return rootDiscoveryService.pollDiscoveryJob(jobId, logOffset);
    }

    /** Assess whether a URL is a crawlable article-listing endpoint. */
    @PostMapping("/{id}/discover/assess")
    public Map<String, Object> assessEndpoint(
            @PathVariable Long id,
            @Valid @RequestBody AssessEndpointRequest request
    ) {
        return rootDiscoveryService.assessEndpoint(id, request.url());
    }

    /** Bulk-save a list of discovered URLs as endpoints under this root. */
    @PostMapping("/{id}/endpoints/bulk")
    @ResponseStatus(HttpStatus.CREATED)
    public List<EndpointResponse> bulkSaveEndpoints(
            @PathVariable Long id,
            @Valid @RequestBody BulkSaveEndpointsRequest request
    ) {
        return rootDiscoveryService.bulkSave(id, request);
    }
}
