package com.example.newscrawler.repository;

import com.example.newscrawler.entity.PostReaction;
import com.example.newscrawler.entity.ReactionType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PostReactionRepository extends JpaRepository<PostReaction, Long> {

    Optional<PostReaction> findByAppUserIdAndPostId(Long appUserId, Long postId);

    long countByPostIdAndReactionType(Long postId, ReactionType reactionType);

    // NEW: bulk fetch AppUser reactions for many posts
    List<PostReaction> findByAppUserIdAndPostIdIn(Long appUserId, List<Long> postIds);

    // NEW: bulk count likes/dislikes
    @Query("""
        SELECT pr.post.id, pr.reactionType, COUNT(pr.id)
        FROM PostReaction pr
        WHERE pr.post.id IN :postIds
        GROUP BY pr.post.id, pr.reactionType
    """)
    List<Object[]> countReactionsForPosts(@Param("postIds") List<Long> postIds);
}
