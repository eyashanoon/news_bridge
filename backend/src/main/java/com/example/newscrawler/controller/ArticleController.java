package com.example.newscrawler.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.security.access.prepost.PreAuthorize;

import com.example.newscrawler.dto.ArticleBlockResponse;
import com.example.newscrawler.dto.ArticleBlocksResponse;
import com.example.newscrawler.dto.ArticleListItemResponse;
import com.example.newscrawler.dto.ArticleResponse;
import com.example.newscrawler.dto.CreateArticleRequest;
import com.example.newscrawler.dto.PagedResponse;
import com.example.newscrawler.service.ArticleService;

import jakarta.validation.Valid;

import org.springframework.web.bind.annotation.CrossOrigin;

@RestController
@CrossOrigin(origins = "*") // Added for React local dev
@RequestMapping("/articles")
public class ArticleController {

    private final ArticleService articleService;

    public ArticleController(ArticleService articleService) {
        this.articleService = articleService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('WRITE_SYSTEM_ARTICLE','UPDATE_ANY_ARTICLE')")
    public ArticleResponse create(@Valid @RequestBody CreateArticleRequest request) {
        return articleService.create(request);
    }

    @GetMapping
    @PreAuthorize("hasRole('READ_ARTICLE')")
    public List<ArticleResponse> listByEndpoint(@RequestParam(required = false) Long endpointId) {
        if (endpointId != null) {
            return articleService.findByEndpoint(endpointId);
        }
        return articleService.findAll();
    }

    @GetMapping("/admin")
    @PreAuthorize("hasAnyRole('UPDATE_ANY_ARTICLE','DELETE_ANY_ARTICLE')")
    public PagedResponse<ArticleListItemResponse> listForAdmin(
            @RequestParam(required = false) Long rootId,
            @RequestParam(required = false) Long endpointId,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return articleService.findForAdmin(rootId, endpointId, search, page, size);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('READ_ARTICLE')")
    public ArticleResponse getById(@PathVariable Long id) {
        return articleService.findById(id);
    }

    @GetMapping("/ids")
    @PreAuthorize("hasRole('READ_ARTICLE')")
    public List<Long> getAllIds() {
        return articleService.findAllIds();
    }

    @GetMapping("/blocks")
    @PreAuthorize("hasRole('READ_ARTICLE')")
    public List<ArticleBlockResponse> getAllBlocks() {
        return articleService.findAllBlocks();
    }

    @GetMapping("/{id}/blocks")
    @PreAuthorize("hasRole('READ_ARTICLE')")
    public ArticleBlocksResponse getBlocksById(@PathVariable Long id) {
        return articleService.findBlocksById(id);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('UPDATE_ANY_ARTICLE')")
    public ArticleResponse update(@PathVariable Long id, @Valid @RequestBody CreateArticleRequest request) {
        return articleService.update(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('DELETE_ANY_ARTICLE')")
    public void delete(@PathVariable Long id) {
        articleService.delete(id);
    }

    @DeleteMapping("/{articleId}/blocks/{blockId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('UPDATE_ANY_ARTICLE')")
    public void deleteBlock(@PathVariable Long articleId, @PathVariable Long blockId) {
        articleService.deleteBlock(articleId, blockId);
    }
}
