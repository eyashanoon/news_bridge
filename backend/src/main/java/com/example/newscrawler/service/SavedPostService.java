package com.example.newscrawler.service;

import com.example.newscrawler.dto.FeedPostDTO;
import com.example.newscrawler.dto.SavedCollectionResponse;
import com.example.newscrawler.dto.SavedPostResponse;
import com.example.newscrawler.entity.AppUser;
import com.example.newscrawler.entity.Post;
import com.example.newscrawler.entity.SavedCollection;
import com.example.newscrawler.entity.SavedPost;
import com.example.newscrawler.repository.SavedCollectionRepository;
import com.example.newscrawler.repository.SavedPostRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class SavedPostService {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final SavedPostRepository savedPostRepository;
    private final SavedCollectionRepository savedCollectionRepository;
    private final SearchService searchService;
    private final PostVisibilityService postVisibilityService;

    public SavedPostService(SavedPostRepository savedPostRepository,
                              SavedCollectionRepository savedCollectionRepository,
                              SearchService searchService,
                              PostVisibilityService postVisibilityService) {
        this.savedPostRepository = savedPostRepository;
        this.savedCollectionRepository = savedCollectionRepository;
        this.searchService = searchService;
        this.postVisibilityService = postVisibilityService;
    }

    @Transactional
    public void savePost(AppUser user, Long postId) {
        Post post = postVisibilityService.requireVisiblePost(postId);
        SavedPost saved = savedPostRepository.findByAppUserIdAndPostId(user.getId(), postId)
                .orElseGet(() -> new SavedPost(user, post, System.currentTimeMillis()));
        if (saved.getId() == null) {
            savedPostRepository.save(saved);
        }
    }

    @Transactional
    public void unsavePost(AppUser user, Long postId) {
        savedPostRepository.deleteByAppUserIdAndPostId(user.getId(), postId);
    }

    @Transactional(readOnly = true)
    public List<SavedPostResponse> listSavedPosts(AppUser user) {
        List<SavedPost> savedPosts = savedPostRepository.findByAppUserIdOrderBySavedAtDesc(user.getId());
        if (savedPosts.isEmpty()) {
            return List.of();
        }

        List<Post> posts = savedPosts.stream()
                .map(SavedPost::getPost)
                .filter(Objects::nonNull)
                .toList();

        List<FeedPostDTO> enriched = searchService.enrichPosts(posts);
        Map<Long, FeedPostDTO> dtoByPostId = enriched.stream()
                .collect(Collectors.toMap(dto -> dto.id, dto -> dto, (a, b) -> a));

        List<SavedPostResponse> result = new ArrayList<>();
        for (SavedPost saved : savedPosts) {
            FeedPostDTO dto = dtoByPostId.get(saved.getPost().getId());
            if (dto == null) continue;
            result.add(SavedPostResponse.from(dto, saved, parseCollectionIds(saved.getCollectionIdsJson())));
        }
        return result;
    }

    @Transactional
    public SavedPostResponse updateSavedPost(AppUser user, Long postId, String note, List<String> collections) {
        SavedPost saved = savedPostRepository.findByAppUserIdAndPostId(user.getId(), postId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Saved post not found"));

        if (note != null) {
            saved.setNote(note);
        }
        if (collections != null) {
            saved.setCollectionIdsJson(toJson(collections));
        }
        savedPostRepository.save(saved);

        FeedPostDTO dto = searchService.getPostById(postId);
        if (dto == null) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found");
        }
        return SavedPostResponse.from(dto, saved, parseCollectionIds(saved.getCollectionIdsJson()));
    }

    @Transactional(readOnly = true)
    public List<SavedCollectionResponse> listCollections(AppUser user) {
        List<SavedCollection> collections = savedCollectionRepository.findByAppUserIdOrderByCreatedAtAsc(user.getId());
        Map<String, Integer> counts = countPostsPerCollection(user.getId());

        return collections.stream()
                .map(col -> SavedCollectionResponse.from(col, counts.getOrDefault(col.getExternalId(), 0)))
                .toList();
    }

    @Transactional
    public SavedCollectionResponse createCollection(AppUser user, String externalId, String name, String icon, Long createdAt) {
        if (externalId == null || externalId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Collection id is required");
        }
        if (name == null || name.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Collection name is required");
        }

        SavedCollection collection = savedCollectionRepository.findByAppUserIdAndExternalId(user.getId(), externalId)
                .orElseGet(() -> new SavedCollection(
                        user,
                        externalId,
                        name.trim(),
                        icon,
                        createdAt != null ? createdAt : System.currentTimeMillis()
                ));

        collection.setName(name.trim());
        if (icon != null && !icon.isBlank()) {
            collection.setIcon(icon);
        }
        savedCollectionRepository.save(collection);

        int postCount = countPostsPerCollection(user.getId()).getOrDefault(externalId, 0);
        return SavedCollectionResponse.from(collection, postCount);
    }

    @Transactional
    public SavedCollectionResponse renameCollection(AppUser user, String externalId, String name, String icon) {
        SavedCollection collection = savedCollectionRepository.findByAppUserIdAndExternalId(user.getId(), externalId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Collection not found"));

        if (name != null && !name.isBlank()) {
            collection.setName(name.trim());
        }
        if (icon != null && !icon.isBlank()) {
            collection.setIcon(icon);
        }
        savedCollectionRepository.save(collection);

        int postCount = countPostsPerCollection(user.getId()).getOrDefault(externalId, 0);
        return SavedCollectionResponse.from(collection, postCount);
    }

    @Transactional
    public void deleteCollection(AppUser user, String externalId) {
        savedCollectionRepository.deleteByAppUserIdAndExternalId(user.getId(), externalId);

        List<SavedPost> savedPosts = savedPostRepository.findByAppUserIdOrderBySavedAtDesc(user.getId());
        for (SavedPost saved : savedPosts) {
            List<String> ids = parseCollectionIds(saved.getCollectionIdsJson());
            if (ids.remove(externalId)) {
                saved.setCollectionIdsJson(toJson(ids));
                savedPostRepository.save(saved);
            }
        }
    }

    private Map<String, Integer> countPostsPerCollection(Long userId) {
        Map<String, Integer> counts = new HashMap<>();
        for (SavedPost saved : savedPostRepository.findByAppUserIdOrderBySavedAtDesc(userId)) {
            for (String collectionId : parseCollectionIds(saved.getCollectionIdsJson())) {
                counts.merge(collectionId, 1, Integer::sum);
            }
        }
        return counts;
    }

    static List<String> parseCollectionIds(String json) {
        if (json == null || json.isBlank()) {
            return new ArrayList<>();
        }
        try {
            List<String> parsed = MAPPER.readValue(json, new TypeReference<List<String>>() {});
            return parsed != null ? new ArrayList<>(parsed) : new ArrayList<>();
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    static String toJson(List<String> ids) {
        try {
            return MAPPER.writeValueAsString(ids != null ? ids : List.of());
        } catch (Exception e) {
            return "[]";
        }
    }
}
