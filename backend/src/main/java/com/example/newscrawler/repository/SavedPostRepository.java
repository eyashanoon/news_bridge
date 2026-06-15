package com.example.newscrawler.repository;

import com.example.newscrawler.entity.SavedPost;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SavedPostRepository extends JpaRepository<SavedPost, Long> {

    List<SavedPost> findByAppUserIdOrderBySavedAtDesc(Long appUserId);

    Optional<SavedPost> findByAppUserIdAndPostId(Long appUserId, Long postId);

    void deleteByAppUserIdAndPostId(Long appUserId, Long postId);
}
