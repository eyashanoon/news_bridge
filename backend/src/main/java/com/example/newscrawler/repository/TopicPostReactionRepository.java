package com.example.newscrawler.repository;

import com.example.newscrawler.entity.ReactionType;
import com.example.newscrawler.entity.TopicPostReaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TopicPostReactionRepository extends JpaRepository<TopicPostReaction, Long> {

    Optional<TopicPostReaction> findByAppUserIdAndTopicPostId(Long appUserId, Long topicPostId);

    List<TopicPostReaction> findByAppUserIdAndTopicPostIdIn(Long appUserId, List<Long> topicPostIds);

    void deleteByTopicPost_Id(Long topicPostId);
}
