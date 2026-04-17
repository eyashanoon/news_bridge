package com.example.newscrawler.controller;

import com.example.newscrawler.dto.CacheEndpointResponse;
import com.example.newscrawler.dto.CreateCacheEndpointRequest;
import com.example.newscrawler.service.CacheEndpointService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/cache-endpoints")
public class CacheEndpointController {

    @Autowired
    private CacheEndpointService cacheEndpointService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public CacheEndpointResponse create(@Valid @RequestBody CreateCacheEndpointRequest request) {
        return cacheEndpointService.create(request);
    }

    @GetMapping
    public CacheEndpointResponse getBySourceAndUrl(
            @RequestParam Long sourceEndpointId,
            @RequestParam String url
    ) {
        return cacheEndpointService.findBySourceEndpointAndUrl(sourceEndpointId, url);
    }

    @GetMapping("/{id}")
    public CacheEndpointResponse getById(@PathVariable Long id) {
        return cacheEndpointService.findById(id);
    }

    @GetMapping("/all")
    public List<CacheEndpointResponse> listAll() {
        return cacheEndpointService.findAll();
    }

    @GetMapping("/by-source")
    public List<CacheEndpointResponse> listBySourceEndpoint(@RequestParam Long sourceEndpointId) {
        return cacheEndpointService.findBySourceEndpointId(sourceEndpointId);
    }

    @PutMapping("/{id}")
    public CacheEndpointResponse update(
            @PathVariable Long id,
            @Valid @RequestBody CreateCacheEndpointRequest request
    ) {
        return cacheEndpointService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        cacheEndpointService.delete(id);
    }
}
