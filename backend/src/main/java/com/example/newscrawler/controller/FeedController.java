package com.example.newscrawler.controller;

import com.example.newscrawler.dto.FeedPostDTO;
import com.example.newscrawler.entity.ReactionType;
import com.example.newscrawler.entity.AppUser;
import com.example.newscrawler.service.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class FeedController {

    private final FeedService feedService;
    private final AppUserService AppUserService;
    private final PostReactionService reactionService;
    private final InteractionService interactionService;

    public FeedController(FeedService feedService,
                          AppUserService AppUserService,
                          PostReactionService reactionService,
                          InteractionService interactionService) {
        this.feedService = feedService;
        this.AppUserService = AppUserService;
        this.reactionService = reactionService;
        this.interactionService = interactionService;
    }

    @GetMapping("/feed")
    public ResponseEntity<List<FeedPostDTO>> getFeed(
            @RequestParam String userId,
            @RequestParam String category,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(defaultValue = "0") int page
    ) {
        AppUser AppUser = AppUserService.getOrCreateUser(userId);
        return ResponseEntity.ok(feedService.getFeed(AppUser, category, limit, page));
    }

    @PutMapping("/posts/{id}/react")
    public ResponseEntity<?> reactToPost(
            @PathVariable Long id,
            @RequestParam String userId,
            @RequestParam ReactionType type
    ) {
        AppUser AppUser = AppUserService.getOrCreateUser(userId);

        String status = reactionService.react(AppUser, id, type);

        long likes = reactionService.getLikesCount(id);
        long dislikes = reactionService.getDislikesCount(id);

        return ResponseEntity.ok(Map.of(
                "status", status,
                "likes", likes,
                "dislikes", dislikes
        ));
    }

    @PostMapping("/posts/{id}/view")
    public ResponseEntity<?> recordView(
            @PathVariable Long id,
            @RequestParam String userId
    ) {
        AppUser AppUser = AppUserService.getOrCreateUser(userId);
        interactionService.recordView(AppUser, id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/posts/{id}/time")
    public ResponseEntity<?> recordTime(
            @PathVariable Long id,
            @RequestParam String userId,
            @RequestParam double seconds
    ) {
        AppUser AppUser = AppUserService.getOrCreateUser(userId);
        interactionService.recordTimeSpent(AppUser, id, seconds);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/posts/{id}/click")
    public ResponseEntity<?> recordClick(
            @PathVariable Long id,
            @RequestParam String userId
    ) {
        AppUser AppUser = AppUserService.getOrCreateUser(userId);
        interactionService.recordClick(AppUser, id);
        return ResponseEntity.ok().build();
    }
}





