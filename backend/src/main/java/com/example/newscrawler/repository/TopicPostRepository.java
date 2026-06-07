package com.example.newscrawler.repository;

import com.example.newscrawler.entity.TopicPost;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface TopicPostRepository extends JpaRepository<TopicPost, Long> {
    List<TopicPost> findByTopicIdOrderByCreatedAtDesc(Long topicId);
    int countByTopicId(Long topicId);

    /** Sum of likes across all posts for a given topic */
    @Query("SELECT COALESCE(SUM(tp.likes), 0) FROM TopicPost tp WHERE tp.topic.id = :topicId")
    int sumLikesByTopicId(@Param("topicId") Long topicId);

    /** Sum of dislikes across all posts for a given topic */
    @Query("SELECT COALESCE(SUM(tp.dislikes), 0) FROM TopicPost tp WHERE tp.topic.id = :topicId")
    int sumDislikesByTopicId(@Param("topicId") Long topicId);

    /** Most recent post creation time for a topic */
    @Query("SELECT MAX(tp.createdAt) FROM TopicPost tp WHERE tp.topic.id = :topicId")
    LocalDateTime findLatestPostCreatedAtByTopicId(@Param("topicId") Long topicId);

    /** Count of posts created since a given timestamp for a topic */
    @Query("SELECT COUNT(tp) FROM TopicPost tp WHERE tp.topic.id = :topicId AND tp.createdAt >= :since")
    int countPostsSinceByTopicId(@Param("topicId") Long topicId, @Param("since") LocalDateTime since);

    /** Sum of likes on posts created since a given timestamp for a topic */
    @Query("SELECT COALESCE(SUM(tp.likes), 0) FROM TopicPost tp WHERE tp.topic.id = :topicId AND tp.createdAt >= :since")
    int sumLikesSinceByTopicId(@Param("topicId") Long topicId, @Param("since") LocalDateTime since);
}
