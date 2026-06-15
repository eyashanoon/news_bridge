package com.example.newscrawler.controller;

import com.example.newscrawler.dto.FeedPostDTO;
import com.example.newscrawler.entity.ReactionType;
import com.example.newscrawler.entity.AppUser;
import com.example.newscrawler.service.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class FeedController {

    private final FeedService feedService;
    private final AppUserResolver appUserResolver;
    private final PostReactionService reactionService;
    private final InteractionService interactionService;

    public FeedController(FeedService feedService,
                          AppUserResolver appUserResolver,
                          PostReactionService reactionService,
                          InteractionService interactionService) {
        this.feedService = feedService;
        this.appUserResolver = appUserResolver;
        this.reactionService = reactionService;
        this.interactionService = interactionService;
    }

    @GetMapping("/feed")
    public ResponseEntity<List<FeedPostDTO>> getFeed(
            @RequestParam(defaultValue = "android-app-anonymous") String userId,
            @RequestParam(defaultValue = "general") String category,
            @RequestParam(defaultValue = "10") int limit,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(required = false) Double lat,
            @RequestParam(required = false) Double lon,
            @RequestParam(required = false) String lang,
            HttpServletRequest request
    ) {
        AppUser appUser = appUserResolver.resolve(request, userId);
        return ResponseEntity.ok(feedService.getFeed(appUser, category, limit, page, lat, lon, lang));
    }

    @GetMapping("/feed/brief")
    public ResponseEntity<List<FeedPostDTO>> getBriefFeed(
            @RequestParam(defaultValue = "30") int limit
    ) {
        /*
         * Endpoint for the news brief feature — returns the most recent posts
         * regardless of tagsExtracted status, with no scoring or dedup.
         */
        return ResponseEntity.ok(feedService.getRecentPostsForBrief(limit));
    }

    @PutMapping("/posts/{id}/react")
    public ResponseEntity<?> reactToPost(
            @PathVariable Long id,
            @RequestParam(required = false) String userId,
            @RequestParam ReactionType type,
            HttpServletRequest request
    ) {
        AppUser appUser = appUserResolver.resolve(request, userId);

        String status = reactionService.react(appUser, id, type);

        long likes = reactionService.getLikesCount(id);
        long dislikes = reactionService.getDislikesCount(id);
        ReactionType userReaction = reactionService.getUserReaction(appUser.getId(), id).orElse(null);

        Map<String, Object> body = new HashMap<>();
        body.put("status", status);
        body.put("likes", likes);
        body.put("dislikes", dislikes);
        body.put("userReaction", userReaction);
        return ResponseEntity.ok(body);
    }

    @PostMapping("/posts/{id}/view")
    public ResponseEntity<?> recordView(
            @PathVariable Long id,
            @RequestParam(required = false) String userId,
            HttpServletRequest request
    ) {
        AppUser appUser = appUserResolver.resolve(request, userId);
        interactionService.recordView(appUser, id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/posts/{id}/time")
    public ResponseEntity<?> recordTime(
            @PathVariable Long id,
            @RequestParam(required = false) String userId,
            @RequestParam double seconds,
            HttpServletRequest request
    ) {
        AppUser appUser = appUserResolver.resolve(request, userId);
        interactionService.recordTimeSpent(appUser, id, seconds);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/posts/{id}/click")
    public ResponseEntity<?> recordClick(
            @PathVariable Long id,
            @RequestParam(required = false) String userId,
            HttpServletRequest request
    ) {
        AppUser appUser = appUserResolver.resolve(request, userId);
        interactionService.recordClick(appUser, id);
        return ResponseEntity.ok().build();
    }
}





