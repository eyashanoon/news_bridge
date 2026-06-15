package com.example.newscrawler.repository;

import com.example.newscrawler.entity.UserChannelPreference;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserChannelPreferenceRepository extends JpaRepository<UserChannelPreference, Long> {
    Optional<UserChannelPreference> findByUser_IdAndChannel_Id(Long userId, Long channelId);
    List<UserChannelPreference> findTop30ByUser_IdOrderByWeightDesc(Long userId);

    @org.springframework.data.jpa.repository.Query("""
        SELECT ucp.channel.id, ucp.channel.displayName, ucp.channel.channelUsername,
               SUM(ucp.weight), COUNT(DISTINCT ucp.user.id)
        FROM UserChannelPreference ucp
        GROUP BY ucp.channel.id, ucp.channel.displayName, ucp.channel.channelUsername
        ORDER BY SUM(ucp.weight) DESC
        """)
    List<Object[]> aggregateTopChannels();

    List<UserChannelPreference> findTop10ByUser_IdOrderByWeightDesc(Long userId);

    long countByUser_Id(Long userId);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(DISTINCT ucp.user.id) FROM UserChannelPreference ucp")
    long countDistinctUsers();
}
