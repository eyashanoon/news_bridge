package com.example.newscrawler.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.example.newscrawler.entity.ArticleBlock;
import com.example.newscrawler.service.ArticleBlockService;

@RestController
@RequestMapping("/article-blocks")
public class ArticleBlockController {

    private final ArticleBlockService articleBlockService;

    public ArticleBlockController(ArticleBlockService articleBlockService) {
        this.articleBlockService = articleBlockService;
    }

    @GetMapping
    public List<ArticleBlock> listAll() {
        return articleBlockService.findAll();
    }

    @GetMapping("/{id}")
    public ArticleBlock getById(@PathVariable Long id) {
        return articleBlockService.findById(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        articleBlockService.delete(id);
    }
}
