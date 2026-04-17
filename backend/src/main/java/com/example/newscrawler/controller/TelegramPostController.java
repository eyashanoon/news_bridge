package com.example.newscrawler.controller;

import com.example.newscrawler.dto.BulkCreateTelegramPostsRequest;
import com.example.newscrawler.dto.TelegramPostResponse;
import com.example.newscrawler.service.TelegramPostService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/telegram/posts")
public class TelegramPostController {

    @Autowired
    private TelegramPostService postService;

    @GetMapping
    @PreAuthorize("hasRole('VIEW_TELEGRAM_POSTS') or hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('MANAGE_USERS')")
    public Page<TelegramPostResponse> getAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return postService.getAll(page, size);
    }

    @GetMapping("/channel/{channelId}")
    @PreAuthorize("hasRole('VIEW_TELEGRAM_POSTS') or hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('MANAGE_USERS')")
    public Page<TelegramPostResponse> getByChannel(
            @PathVariable Long channelId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return postService.getByChannel(channelId, page, size);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('VIEW_TELEGRAM_POSTS') or hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('MANAGE_USERS')")
    public TelegramPostResponse getById(@PathVariable Long id) {
        return postService.getById(id);
    }

    @PostMapping("/bulk")
    @PreAuthorize("hasRole('WRITE_TELEGRAM_POSTS')")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> bulkCreate(@RequestBody BulkCreateTelegramPostsRequest req) {
        return postService.bulkCreate(req.posts);
    }

    @PutMapping("/{id}/content")
    @PreAuthorize("hasRole('VIEW_TELEGRAM_POSTS') or hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('MANAGE_USERS')")
    public TelegramPostResponse updateContent(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        return postService.updateContent(id, body.get("content"));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('MANAGE_USERS')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        postService.delete(id);
    }
}
