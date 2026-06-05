package com.example.newscrawler.repository;

import com.example.newscrawler.entity.TopicPost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TopicPostRepository extends JpaRepository<TopicPost, Long> {
    List<TopicPost> findByTopicIdOrderByCreatedAtDesc(Long topicId);
    int countByTopicId(Long topicId);
}