package com.example.newscrawler.repository;

import com.example.newscrawler.entity.CategoryField;
import com.example.newscrawler.entity.NewsEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface NewsEventRepository extends JpaRepository<NewsEvent, Long> {
    List<NewsEvent> findByField(CategoryField field);
    List<NewsEvent> findByStatus(String status);
    List<NewsEvent> findByFieldAndStatusIn(CategoryField field, List<String> statuses);
    List<NewsEvent> findByStatusIn(List<String> statuses);
}
