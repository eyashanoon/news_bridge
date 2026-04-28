package com.example.newscrawler.controller;

import com.example.newscrawler.dto.PostDTO;
import com.example.newscrawler.dto.CreatePostRequest;
import com.example.newscrawler.dto.MediaItemResponse;
import com.example.newscrawler.dto.ArticleContentResponse;
import com.example.newscrawler.dto.PostByTagResponse;
import com.example.newscrawler.entity.Post;
import com.example.newscrawler.entity.ReactionType;
import com.example.newscrawler.entity.AppUser;
import com.example.newscrawler.service.PostReactionService;
import com.example.newscrawler.service.PostService;
import com.example.newscrawler.service.ArticleService;
import com.example.newscrawler.service.AppUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.List;

@RestController
@RequestMapping("/api/posts")
@CrossOrigin(origins = "*")
public class PostController {

    private final PostService postService;
    private final PostReactionService reactionService;
    private final ArticleService articleService;
    private final AppUserService AppUserService;

    public PostController(PostService postService,
                          PostReactionService reactionService,
                          ArticleService articleService,
                          AppUserService AppUserService) {
        this.postService = postService;
        this.reactionService = reactionService;
        this.articleService = articleService;
        this.AppUserService = AppUserService;
    }

    @GetMapping("/random")
    public ResponseEntity<Post> getRandomPost(@RequestParam String category) {
        return postService.getRandomPost(category)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Post createPost(@RequestBody CreatePostRequest request) {
        return postService.createPost(request);
    }

    @GetMapping("/by-article/{articleId}")
    public List<Post> getPostsByArticleId(@PathVariable Long articleId) {
        return postService.findByArticleId(articleId);
    }

    @GetMapping("/{id}/media")
    public List<MediaItemResponse> getMediaByPostId(@PathVariable Long id) {
        Post post = postService.findById(id);
        if (post.getArticle() == null) {
            return List.of();
        }
        return articleService.findMediaById(post.getArticle().getId());
    }

    @GetMapping("/{id}/content")
    public ArticleContentResponse getContentByPostId(@PathVariable Long id) {
        Post post = postService.findById(id);
        if (post.getArticle() == null) {
            return new ArticleContentResponse(List.of());
        }
        return articleService.findContentById(post.getArticle().getId());
    }

    @GetMapping("/by-tags")
    public ResponseEntity<List<PostByTagResponse>> getPostsByTags(@RequestParam List<String> tags) {
        if (tags == null || tags.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        List<PostByTagResponse> posts = postService.findPostsByTags(tags);
        return ResponseEntity.ok(posts);
    }

/*
    @PutMapping("/{id}/react")
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
    }*/
}





