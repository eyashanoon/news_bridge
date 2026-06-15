package com.example.newscrawler.controller;

import com.example.newscrawler.dto.SavedCollectionResponse;
import com.example.newscrawler.dto.SavedPostResponse;
import com.example.newscrawler.entity.AppUser;
import com.example.newscrawler.service.AppUserResolver;
import com.example.newscrawler.service.SavedPostService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class SavedPostController {

    private final SavedPostService savedPostService;
    private final AppUserResolver appUserResolver;

    public SavedPostController(SavedPostService savedPostService, AppUserResolver appUserResolver) {
        this.savedPostService = savedPostService;
        this.appUserResolver = appUserResolver;
    }

    @PostMapping("/posts/{postId}/save")
    @ResponseStatus(HttpStatus.OK)
    public void savePost(
            @PathVariable Long postId,
            @RequestParam(required = false) String userId,
            HttpServletRequest request) {
        AppUser user = appUserResolver.resolve(request, userId);
        savedPostService.savePost(user, postId);
    }

    @PostMapping("/posts/{postId}/unsave")
    @ResponseStatus(HttpStatus.OK)
    public void unsavePost(
            @PathVariable Long postId,
            @RequestParam(required = false) String userId,
            HttpServletRequest request) {
        AppUser user = appUserResolver.resolve(request, userId);
        savedPostService.unsavePost(user, postId);
    }

    @GetMapping("/user/{userId}/saved-posts")
    public List<SavedPostResponse> listSavedPosts(
            @PathVariable String userId,
            HttpServletRequest request) {
        AppUser user = appUserResolver.resolve(request, userId);
        return savedPostService.listSavedPosts(user);
    }

    @PutMapping("/user/{userId}/saved-posts/{postId}")
    public SavedPostResponse updateSavedPost(
            @PathVariable String userId,
            @PathVariable Long postId,
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        AppUser user = appUserResolver.resolve(request, userId);
        String note = body.containsKey("note") ? String.valueOf(body.get("note")) : null;
        List<String> collections = null;
        if (body.get("collections") instanceof List<?> rawList) {
            collections = rawList.stream().map(String::valueOf).toList();
        }
        return savedPostService.updateSavedPost(user, postId, note, collections);
    }

    @GetMapping("/user/{userId}/saved-collections")
    public List<SavedCollectionResponse> listCollections(
            @PathVariable String userId,
            HttpServletRequest request) {
        AppUser user = appUserResolver.resolve(request, userId);
        return savedPostService.listCollections(user);
    }

    @PostMapping("/user/{userId}/saved-collections")
    public SavedCollectionResponse createCollection(
            @PathVariable String userId,
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        AppUser user = appUserResolver.resolve(request, userId);
        String externalId = body.get("id") != null ? String.valueOf(body.get("id")) : null;
        String name = body.get("name") != null ? String.valueOf(body.get("name")) : null;
        String icon = body.get("icon") != null ? String.valueOf(body.get("icon")) : null;
        Long createdAt = body.get("createdAt") instanceof Number n ? n.longValue() : null;
        return savedPostService.createCollection(user, externalId, name, icon, createdAt);
    }

    @PutMapping("/user/{userId}/saved-collections/{collectionId}")
    public SavedCollectionResponse updateCollection(
            @PathVariable String userId,
            @PathVariable String collectionId,
            @RequestBody Map<String, Object> body,
            HttpServletRequest request) {
        AppUser user = appUserResolver.resolve(request, userId);
        String name = body.get("name") != null ? String.valueOf(body.get("name")) : null;
        String icon = body.get("icon") != null ? String.valueOf(body.get("icon")) : null;
        return savedPostService.renameCollection(user, collectionId, name, icon);
    }

    @DeleteMapping("/user/{userId}/saved-collections/{collectionId}")
    public ResponseEntity<Void> deleteCollection(
            @PathVariable String userId,
            @PathVariable String collectionId,
            HttpServletRequest request) {
        AppUser user = appUserResolver.resolve(request, userId);
        savedPostService.deleteCollection(user, collectionId);
        return ResponseEntity.noContent().build();
    }
}
