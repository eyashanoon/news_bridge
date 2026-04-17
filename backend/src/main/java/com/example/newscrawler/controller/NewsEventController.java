package com.example.newscrawler.controller;

import com.example.newscrawler.dto.*;
import com.example.newscrawler.service.NewsEventService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/events")
public class NewsEventController {

    @Autowired
    private NewsEventService eventService;

    // ─── Public: list PUBLIC events ──────────────────────────────────────────

    @GetMapping("/public")
    public List<NewsEventResponse> getPublicEvents() {
        return eventService.getPublicEvents();
    }

    // ─── Admin: list all events ────────────────────────────────────────────

    @GetMapping
    @PreAuthorize("hasRole('MANAGE_EVENTS') or hasRole('MANAGE_USERS') or hasRole('APPROVE_EDITOR_REQUESTS')")
    public List<NewsEventResponse> getAllEvents() {
        return eventService.getAllEvents();
    }

    // ─── Editor: list events for their field ─────────────────────────────────

    @GetMapping("/my-field")
    @PreAuthorize("hasRole('PUBLISH_LIVE_NEWS') or hasRole('EDIT_LIVE_NEWS')")
    public List<NewsEventResponse> getMyFieldEvents(@AuthenticationPrincipal String userEmail) {
        return eventService.getEventsForEditor(userEmail);
    }

    // ─── Get single event ─────────────────────────────────────────────────────

    @GetMapping("/{id}")
    public NewsEventResponse getEvent(@PathVariable Long id) {
        return eventService.getEvent(id);
    }

    // ─── Admin: create event ──────────────────────────────────────────────────

    @PostMapping
    @PreAuthorize("hasRole('MANAGE_EVENTS') or hasRole('MANAGE_USERS')")
    @ResponseStatus(HttpStatus.CREATED)
    public NewsEventResponse createEvent(
            @RequestBody CreateNewsEventRequest req,
            @AuthenticationPrincipal String userEmail) {
        return eventService.createEvent(req, userEmail);
    }

    // ─── Admin: update event ──────────────────────────────────────────────────

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('MANAGE_EVENTS') or hasRole('MANAGE_USERS')")
    public NewsEventResponse updateEvent(@PathVariable Long id, @RequestBody CreateNewsEventRequest req) {
        return eventService.updateEvent(id, req);
    }

    // ─── Admin: change status ─────────────────────────────────────────────────

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('MANAGE_EVENTS') or hasRole('MANAGE_USERS')")
    public NewsEventResponse changeStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return eventService.changeStatus(id, body.get("status"));
    }

    // ─── Admin: delete event ──────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('MANAGE_EVENTS') or hasRole('MANAGE_USERS')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteEvent(@PathVariable Long id) {
        eventService.deleteEvent(id);
    }

    // ─── Editor: request publish permission ──────────────────────────────────

    @PostMapping("/{id}/publish-requests")
    @PreAuthorize("hasRole('PUBLISH_LIVE_NEWS') or hasRole('EDIT_LIVE_NEWS')")
    @ResponseStatus(HttpStatus.CREATED)
    public PublishRequestResponse requestPublish(
            @PathVariable Long id,
            @AuthenticationPrincipal String userEmail) {
        return eventService.requestPublishPermission(id, userEmail);
    }

    // ─── Admin: list publish requests for event ───────────────────────────────

    @GetMapping("/{id}/publish-requests")
    @PreAuthorize("hasRole('MANAGE_EVENTS') or hasRole('MANAGE_USERS') or hasRole('APPROVE_EDITOR_REQUESTS') or hasRole('APPROVE_PUBLISH_REQUESTS')")
    public List<PublishRequestResponse> getPublishRequests(@PathVariable Long id) {
        return eventService.getPublishRequests(id);
    }

    // ─── Editor: list own publish requests ───────────────────────────────────

    @GetMapping("/my-publish-requests")
    @PreAuthorize("hasRole('PUBLISH_LIVE_NEWS') or hasRole('EDIT_LIVE_NEWS')")
    public List<PublishRequestResponse> getMyPublishRequests(@AuthenticationPrincipal String userEmail) {
        return eventService.getMyPublishRequests(userEmail);
    }

    // ─── Admin: approve publish request ──────────────────────────────────────

    @PutMapping("/publish-requests/{requestId}/approve")
    @PreAuthorize("hasRole('MANAGE_EVENTS') or hasRole('MANAGE_USERS') or hasRole('APPROVE_EDITOR_REQUESTS') or hasRole('APPROVE_PUBLISH_REQUESTS')")
    public PublishRequestResponse approveRequest(
            @PathVariable Long requestId,
            @AuthenticationPrincipal String userEmail) {
        return eventService.reviewPublishRequest(requestId, true, userEmail);
    }

    // ─── Admin: reject publish request ───────────────────────────────────────

    @PutMapping("/publish-requests/{requestId}/reject")
    @PreAuthorize("hasRole('MANAGE_EVENTS') or hasRole('MANAGE_USERS') or hasRole('APPROVE_EDITOR_REQUESTS') or hasRole('APPROVE_PUBLISH_REQUESTS')")
    public PublishRequestResponse rejectRequest(
            @PathVariable Long requestId,
            @AuthenticationPrincipal String userEmail) {
        return eventService.reviewPublishRequest(requestId, false, userEmail);
    }
}
