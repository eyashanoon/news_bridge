package com.example.newscrawler.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.example.newscrawler.entity.ArticleTitle;

public interface ArticleTitleRepository extends JpaRepository<ArticleTitle, Long> {
}
