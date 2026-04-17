package com.example.newscrawler.repository;

import com.example.newscrawler.entity.EditorUser;
import com.example.newscrawler.entity.LiveNewsPost;
import com.example.newscrawler.entity.NewsEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface LiveNewsPostRepository extends JpaRepository<LiveNewsPost, Long> {
    List<LiveNewsPost> findByEventOrderByPublishedAtDesc(NewsEvent event);
    List<LiveNewsPost> findByAuthorOrderByPublishedAtDesc(EditorUser author);
    List<LiveNewsPost> findByEvent_IdOrderByPublishedAtDesc(Long eventId);
}
