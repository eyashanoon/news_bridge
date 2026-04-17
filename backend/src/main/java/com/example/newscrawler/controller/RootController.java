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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.example.newscrawler.dto.CreateRootRequest;
import com.example.newscrawler.dto.RootResponse;
import com.example.newscrawler.dto.UpdateRecordStatusRequest;
import com.example.newscrawler.service.RootService;

import jakarta.validation.Valid;

@RestController
@RequestMapping("/roots")
public class RootController {

    private final RootService rootService;

    public RootController(RootService rootService) {
        this.rootService = rootService;
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
}
