package com.example.newscrawler.controller;

import com.example.newscrawler.dto.FeedPostDTO;
import com.example.newscrawler.service.SearchService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/posts/search")
@CrossOrigin(origins = "*")
public class SearchController {

    private final SearchService searchService;

    public SearchController(SearchService searchService) {
        this.searchService = searchService;
    }

    /**
     * Search all posts by keyword across title and text.
     * Searches ALL posts in the database regardless of tagsExtracted or seen status.
     *
     * @param query    Search keyword
     * @param category Optional category filter
     * @param lang     Optional language filter (en, ar)
     * @param page     Page number (0-based, default 0)
     * @param limit    Results per page (default 10)
     * @return List of matching FeedPostDTOs
     */
    @GetMapping
    public ResponseEntity<List<FeedPostDTO>> search(
            @RequestParam(defaultValue = "") String query,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String lang,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int limit
    ) {
        List<FeedPostDTO> results = searchService.searchPosts(
                query,
                category,
                lang,
                page,
                limit
        );
        return ResponseEntity.ok(results);
    }

    /**
     * Get a single post by ID with full details.
     */
    @GetMapping("/{id}")
    public ResponseEntity<FeedPostDTO> getPostById(@PathVariable Long id) {
        FeedPostDTO post = searchService.getPostById(id);
        if (post == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(post);
    }
}