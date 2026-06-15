package com.example.newscrawler.repository;

import com.example.newscrawler.entity.ChannelTag;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ChannelTagRepository extends JpaRepository<ChannelTag, Long> {
    List<ChannelTag> findByChannel_Id(Long channelId);
    void deleteByChannel_Id(Long channelId);

    @Query("SELECT DISTINCT t.channel.id FROM ChannelTag t WHERE LOWER(t.tag) LIKE LOWER(CONCAT('%', :tag, '%'))")
    List<Long> findChannelIdsByTagLike(@Param("tag") String tag);

    @Query("SELECT t.tag, AVG(t.weight) FROM ChannelTag t GROUP BY t.tag ORDER BY AVG(t.weight) DESC")
    List<Object[]> aggregateTopTags(org.springframework.data.domain.Pageable pageable);
}
