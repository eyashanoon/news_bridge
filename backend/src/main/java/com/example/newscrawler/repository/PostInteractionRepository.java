package com.example.newscrawler.repository;

import com.example.newscrawler.entity.PostInteraction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PostInteractionRepository extends JpaRepository<PostInteraction, Long> {

    Optional<PostInteraction> findByAppUserIdAndPostId(Long appUserId, Long postId);

    // NEW: get IDs of posts that AppUser already interacted with (seen)
    @Query("SELECT pi.post.id FROM PostInteraction pi WHERE pi.appUser.id = :appUserId")
    List<Long> findSeenPostIdsByAppUserId(@Param("appUserId") Long appUserId);
}
