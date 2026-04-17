package com.example.newscrawler.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.example.newscrawler.dto.CreateEndpointRequest;
import com.example.newscrawler.dto.EndpointResponse;
import com.example.newscrawler.dto.UpdateRecordStatusRequest;
import com.example.newscrawler.service.EndpointService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/endpoints")
public class EndpointController {

    private final EndpointService endpointService;

    public EndpointController(EndpointService endpointService) {
        this.endpointService = endpointService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EndpointResponse create(@Valid @RequestBody CreateEndpointRequest request) {
        return endpointService.create(request);
    }

    @GetMapping
    public List<EndpointResponse> listByRoot(
            @RequestParam(required = false) Long rootId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status
    ) {
        return endpointService.findByRoot(rootId, search, status);
    }

    @GetMapping("/{id}")
    public EndpointResponse getById(@PathVariable Long id) {
        return endpointService.findById(id);
    }

    @PutMapping("/{id}")
    public EndpointResponse update(@PathVariable Long id, @Valid @RequestBody CreateEndpointRequest request) {
        return endpointService.update(id, request);
    }

    @PutMapping("/{id}/status")
    public EndpointResponse updateStatus(@PathVariable Long id, @RequestBody UpdateRecordStatusRequest request) {
        return endpointService.updateStatus(id, request.status());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id, @RequestParam(defaultValue = "false") boolean hard) {
        endpointService.delete(id, hard);
    }
}
