package com.example.newscrawler.service;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.example.newscrawler.entity.ArticleBlock;
import com.example.newscrawler.repository.ArticleBlockRepository;

@Service
public class ArticleBlockService {

    private final ArticleBlockRepository articleBlockRepository;

    public ArticleBlockService(ArticleBlockRepository articleBlockRepository) {
        this.articleBlockRepository = articleBlockRepository;
    }

    @Transactional(readOnly = true)
    public List<ArticleBlock> findAll() {
        return articleBlockRepository.findAll();
    }

    @Transactional(readOnly = true)
    public ArticleBlock findById(Long id) {
        return articleBlockRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Article Block not found"));
    }

    public void delete(Long id) {
        if (!articleBlockRepository.existsById(id)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Article Block not found");
        }
        articleBlockRepository.deleteById(id);
    }
}
