package com.example.newscrawler.service;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.example.newscrawler.entity.ArticleTitle;
import com.example.newscrawler.repository.ArticleTitleRepository;

@Service
public class ArticleTitleService {

    private final ArticleTitleRepository articleTitleRepository;

    public ArticleTitleService(ArticleTitleRepository articleTitleRepository) {
        this.articleTitleRepository = articleTitleRepository;
    }

    @Transactional(readOnly = true)
    public List<ArticleTitle> findAll() {
        return articleTitleRepository.findAll();
    }

    @Transactional(readOnly = true)
    public ArticleTitle findById(Long id) {
        return articleTitleRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Article Title not found"));
    }

    public void delete(Long id) {
        if (!articleTitleRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Article Title not found");
        }
        articleTitleRepository.deleteById(id);
    }
}
