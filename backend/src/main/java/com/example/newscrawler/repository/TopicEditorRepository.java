package com.example.newscrawler.repository;

import com.example.newscrawler.entity.TopicEditorAssignment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TopicEditorRepository extends JpaRepository<TopicEditorAssignment, Long> {
    List<TopicEditorAssignment> findByTopicId(Long topicId);
    List<TopicEditorAssignment> findByEditorId(Long editorId);
    Optional<TopicEditorAssignment> findByTopicIdAndEditorId(Long topicId, Long editorId);
    List<TopicEditorAssignment> findByTopicIdAndStatus(Long topicId, String status);
    List<TopicEditorAssignment> findByEditorIdAndStatus(Long editorId, String status);
}