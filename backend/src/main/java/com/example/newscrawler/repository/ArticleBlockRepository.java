package com.example.newscrawler.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import com.example.newscrawler.entity.ArticleBlock;

public interface ArticleBlockRepository extends JpaRepository<ArticleBlock, Long> {
}
