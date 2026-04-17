package com.example.newscrawler.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.example.newscrawler.entity.Article;

public interface ArticleRepository extends JpaRepository<Article, Long>, JpaSpecificationExecutor<Article> {
    List<Article> findByEndpointId(Long endpointId);

    boolean existsByUrl(String url);

    boolean existsByUrlAndIdNot(String url, Long id);

    @Query("SELECT a.id FROM Article a ORDER BY a.createdAt DESC")
    List<Long> findAllIds();

    @Query("SELECT r.name FROM Article a JOIN a.endpoint e JOIN e.root r WHERE a.id = :articleId")
    Optional<String> findRootNameByArticleId(@Param("articleId") Long articleId);
}
