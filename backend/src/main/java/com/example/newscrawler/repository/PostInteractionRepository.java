package com.example.newscrawler.repository;

import com.example.newscrawler.entity.PostInteraction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface PostInteractionRepository extends JpaRepository<PostInteraction, Long> {

    Optional<PostInteraction> findByAppUserIdAndPostId(Long appUserId, Long postId);

    List<PostInteraction> findByAppUserIdAndPostIdIn(Long appUserId, List<Long> postIds);

    // NEW: get IDs of posts that AppUser already interacted with (seen)
    @Query("SELECT pi.post.id FROM PostInteraction pi WHERE pi.appUser.id = :appUserId")
    List<Long> findSeenPostIdsByAppUserId(@Param("appUserId") Long appUserId);

    @Query("SELECT pi.appUser.id, MAX(pi.lastViewedAt) FROM PostInteraction pi GROUP BY pi.appUser.id")
    List<Object[]> aggregateLastViewedByUser();

    @Query("""
        SELECT pi.appUser.id, COALESCE(SUM(pi.views), 0), COALESCE(SUM(pi.clicks), 0), COALESCE(SUM(pi.totalTimeSpent), 0)
        FROM PostInteraction pi GROUP BY pi.appUser.id
        """)
    List<Object[]> aggregateEngagementByUser();

    @Query("""
        SELECT FUNCTION('DATE', pi.lastViewedAt), COUNT(DISTINCT pi.appUser.id)
        FROM PostInteraction pi
        WHERE pi.lastViewedAt >= :since
        GROUP BY FUNCTION('DATE', pi.lastViewedAt)
        ORDER BY FUNCTION('DATE', pi.lastViewedAt)
        """)
    List<Object[]> countActiveUsersPerDaySince(@Param("since") LocalDateTime since);

    @Query("""
        SELECT FUNCTION('HOUR', pi.lastViewedAt), COUNT(pi.id)
        FROM PostInteraction pi
        WHERE pi.lastViewedAt >= :since
        GROUP BY FUNCTION('HOUR', pi.lastViewedAt)
        ORDER BY FUNCTION('HOUR', pi.lastViewedAt)
        """)
    List<Object[]> countInteractionsByHourSince(@Param("since") LocalDateTime since);

    @Query("""
        SELECT FUNCTION('DATE', pi.lastViewedAt), COUNT(pi.id)
        FROM PostInteraction pi
        WHERE pi.lastViewedAt >= :since
        GROUP BY FUNCTION('DATE', pi.lastViewedAt)
        ORDER BY FUNCTION('DATE', pi.lastViewedAt)
        """)
    List<Object[]> countInteractionsPerDaySince(@Param("since") LocalDateTime since);

    @Query("SELECT COALESCE(SUM(pi.views), 0), COALESCE(SUM(pi.clicks), 0), COALESCE(SUM(pi.totalTimeSpent), 0) FROM PostInteraction pi")
    List<Object[]> aggregateTotals();

    @Query("""
        SELECT pi.appUser.id, COALESCE(SUM(pi.views), 0), COALESCE(SUM(pi.clicks), 0), COALESCE(SUM(pi.totalTimeSpent), 0)
        FROM PostInteraction pi
        GROUP BY pi.appUser.id
        ORDER BY (COALESCE(SUM(pi.views), 0) + COALESCE(SUM(pi.clicks), 0) * 3) DESC
        """)
    List<Object[]> topEngagedUsers();

    @Query("""
        SELECT COALESCE(SUM(pi.views), 0), COALESCE(SUM(pi.clicks), 0), COALESCE(SUM(pi.totalTimeSpent), 0), COUNT(pi.id)
        FROM PostInteraction pi
        WHERE pi.appUser.id = :userId
        """)
    List<Object[]> aggregateEngagementForUser(@Param("userId") Long userId);

    @Query("""
        SELECT COALESCE(SUM(pi.views), 0), COALESCE(SUM(pi.clicks), 0), COALESCE(SUM(pi.totalTimeSpent), 0), COUNT(pi.id)
        FROM PostInteraction pi
        WHERE pi.appUser.id = :userId AND pi.lastViewedAt >= :since
        """)
    List<Object[]> aggregateEngagementForUserSince(@Param("userId") Long userId, @Param("since") LocalDateTime since);

    @Query("""
        SELECT FUNCTION('DATE', pi.lastViewedAt), COUNT(pi.id)
        FROM PostInteraction pi
        WHERE pi.appUser.id = :userId AND pi.lastViewedAt >= :since
        GROUP BY FUNCTION('DATE', pi.lastViewedAt)
        ORDER BY FUNCTION('DATE', pi.lastViewedAt)
        """)
    List<Object[]> countInteractionsPerDayForUserSince(@Param("userId") Long userId, @Param("since") LocalDateTime since);

    @Query("""
        SELECT COUNT(DISTINCT pi.appUser.id)
        FROM PostInteraction pi
        WHERE pi.lastViewedAt >= :since
        """)
    long countDistinctActiveUsersSince(@Param("since") LocalDateTime since);

    void deleteByPost_Id(Long postId);
}
