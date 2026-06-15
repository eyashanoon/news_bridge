package com.example.newscrawler.repository;

import com.example.newscrawler.entity.EditorUser;
import com.example.newscrawler.entity.LiveNewsPost;
import com.example.newscrawler.entity.NewsEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface LiveNewsPostRepository extends JpaRepository<LiveNewsPost, Long> {
    List<LiveNewsPost> findByEventOrderByPublishedAtDesc(NewsEvent event);
    List<LiveNewsPost> findByAuthorOrderByPublishedAtDesc(EditorUser author);
    List<LiveNewsPost> findByEvent_IdOrderByPublishedAtDesc(Long eventId);

    long countByAuthor_Id(Long authorId);

    @org.springframework.data.jpa.repository.Query("""
        SELECT lnp.author.id, COUNT(lnp), MAX(lnp.publishedAt)
        FROM LiveNewsPost lnp
        GROUP BY lnp.author.id
        """)
    List<Object[]> aggregateByAuthor();

    @org.springframework.data.jpa.repository.Query("""
        SELECT FUNCTION('DATE', lnp.publishedAt), COUNT(lnp)
        FROM LiveNewsPost lnp
        WHERE lnp.publishedAt >= :since
        GROUP BY FUNCTION('DATE', lnp.publishedAt)
        ORDER BY FUNCTION('DATE', lnp.publishedAt)
        """)
    List<Object[]> countContributionsPerDaySince(@Param("since") Instant since);
}
