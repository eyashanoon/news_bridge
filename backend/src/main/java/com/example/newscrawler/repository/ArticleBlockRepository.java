package com.example.newscrawler.repository;

import com.example.newscrawler.entity.ArticleBlock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ArticleBlockRepository extends JpaRepository<ArticleBlock, Long> {

    @Query("SELECT b FROM com.example.newscrawler.entity.ArticleImageBlock b WHERE b.article.id IN :articleIds")
    List<ArticleBlock> findImageBlocksByArticleIds(@Param("articleIds") List<Long> articleIds);

    @Query("SELECT b FROM com.example.newscrawler.entity.ArticleTextBlock b WHERE b.article.id IN :articleIds ORDER BY b.sortOrder ASC")
    List<com.example.newscrawler.entity.ArticleTextBlock> findTextBlocksByArticleIds(@Param("articleIds") List<Long> articleIds);
}
