package com.example.newscrawler.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.example.newscrawler.entity.ArticleTitle;
import com.example.newscrawler.service.ArticleTitleService;

@RestController
@RequestMapping("/article-titles")
public class ArticleTitleController {

    private final ArticleTitleService articleTitleService;

    public ArticleTitleController(ArticleTitleService articleTitleService) {
        this.articleTitleService = articleTitleService;
    }

    @GetMapping
    public List<ArticleTitle> listAll() {
        return articleTitleService.findAll();
    }

    @GetMapping("/{id}")
    public ArticleTitle getById(@PathVariable Long id) {
        return articleTitleService.findById(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        articleTitleService.delete(id);
    }
}
