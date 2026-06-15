package com.example.newscrawler.repository;

import com.example.newscrawler.entity.TelegramPostTag;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface TelegramPostTagRepository extends JpaRepository<TelegramPostTag, Long> {

    void deleteByTelegramPost_Id(Long telegramPostId);

    List<TelegramPostTag> findByTelegramPost_Id(Long telegramPostId);

    @Query("SELECT t FROM TelegramPostTag t JOIN FETCH t.telegramPost p WHERE p.id IN :ids")
    List<TelegramPostTag> findWithPostByPostIdIn(@Param("ids") Collection<Long> ids);

    @Query("SELECT DISTINCT t.telegramPost.id FROM TelegramPostTag t WHERE LOWER(t.tag) LIKE LOWER(CONCAT('%', :q, '%'))")
    List<Long> findPostIdsByTagLike(@Param("q") String q);

    @Query("SELECT t.tag, COUNT(t) FROM TelegramPostTag t GROUP BY t.tag ORDER BY COUNT(t) DESC")
    List<Object[]> findPopularTags(Pageable pageable);
}
