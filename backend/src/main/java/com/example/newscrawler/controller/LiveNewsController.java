package com.example.newscrawler.controller;

import com.example.newscrawler.dto.CreateLiveNewsPostRequest;
import com.example.newscrawler.dto.LiveNewsPostResponse;
import com.example.newscrawler.dto.UpdateLiveNewsPostRequest;
import com.example.newscrawler.entity.UserRole;
import com.example.newscrawler.service.LiveNewsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/live-news")
public class LiveNewsController {

    @Autowired
    private LiveNewsService liveNewsService;

    // ─── Get live news for an event (public if event is PUBLIC) ─────────────

    @GetMapping
    public List<LiveNewsPostResponse> getForEvent(@RequestParam Long eventId) {
        return liveNewsService.getByEvent(eventId);
    }

    // ─── Editor: publish a live news post ────────────────────────────────────

    @PostMapping
    @PreAuthorize("hasRole('PUBLISH_LIVE_NEWS')")
    @ResponseStatus(HttpStatus.CREATED)
    public LiveNewsPostResponse publish(
            @RequestBody CreateLiveNewsPostRequest req,
            @AuthenticationPrincipal String userEmail) {
        return liveNewsService.publish(req, userEmail);
    }

    // ─── Update a live news post (own or admin) ───────────────────────────────

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('PUBLISH_LIVE_NEWS') or hasRole('EDIT_LIVE_NEWS') or hasRole('UPDATE_ANY_ARTICLE')")
    public LiveNewsPostResponse update(
            @PathVariable Long id,
            @RequestBody UpdateLiveNewsPostRequest req,
            @AuthenticationPrincipal String userEmail,
            org.springframework.security.core.Authentication auth) {
        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_UPDATE_ANY_ARTICLE"));
        return liveNewsService.update(id, req, userEmail, isAdmin);
    }

    // ─── Delete a live news post (own or admin) ───────────────────────────────

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('PUBLISH_LIVE_NEWS') or hasRole('DELETE_LIVE_NEWS') or hasRole('DELETE_ANY_ARTICLE')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @PathVariable Long id,
            @AuthenticationPrincipal String userEmail,
            org.springframework.security.core.Authentication auth) {
        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_DELETE_ANY_ARTICLE"));
        liveNewsService.delete(id, userEmail, isAdmin);
    }
}
