package com.example.newscrawler.controller;

import com.example.newscrawler.dto.CreateTelegramChannelRequest;
import com.example.newscrawler.dto.TelegramChannelResponse;
import com.example.newscrawler.service.TelegramChannelService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/telegram/channels")
public class TelegramChannelController {

    @Autowired
    private TelegramChannelService channelService;

    @GetMapping
    @PreAuthorize("hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('VIEW_TELEGRAM_POSTS') or hasRole('MANAGE_USERS')")
    public List<TelegramChannelResponse> getAll() {
        return channelService.getAll();
    }

    @GetMapping("/active")
    @PreAuthorize("hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('WRITE_TELEGRAM_POSTS') or hasRole('MANAGE_USERS')")
    public List<TelegramChannelResponse> getActive() {
        return channelService.getActive();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('VIEW_TELEGRAM_POSTS') or hasRole('MANAGE_USERS')")
    public TelegramChannelResponse getById(@PathVariable Long id) {
        return channelService.getById(id);
    }

    @PostMapping
    @PreAuthorize("hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('MANAGE_USERS')")
    @ResponseStatus(HttpStatus.CREATED)
    public TelegramChannelResponse create(
            @RequestBody CreateTelegramChannelRequest req,
            @AuthenticationPrincipal String userEmail) {
        return channelService.create(req, userEmail);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('MANAGE_USERS')")
    public TelegramChannelResponse update(
            @PathVariable Long id,
            @RequestBody CreateTelegramChannelRequest req) {
        return channelService.update(id, req);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('MANAGE_USERS')")
    public TelegramChannelResponse changeStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        return channelService.changeStatus(id, body.get("status"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('MANAGE_USERS')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        channelService.delete(id);
    }
}
