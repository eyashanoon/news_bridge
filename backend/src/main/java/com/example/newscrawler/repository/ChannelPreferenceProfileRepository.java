package com.example.newscrawler.repository;

import com.example.newscrawler.entity.ChannelPreferenceProfile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ChannelPreferenceProfileRepository extends JpaRepository<ChannelPreferenceProfile, Long> {
    Optional<ChannelPreferenceProfile> findByChannel_Id(Long channelId);

    List<ChannelPreferenceProfile> findByScope(String scope);

    List<ChannelPreferenceProfile> findByPurpose(String purpose);

    List<ChannelPreferenceProfile> findByCountry(String country);

    @Query("SELECT p.scope, COUNT(p) FROM ChannelPreferenceProfile p WHERE p.scope IS NOT NULL GROUP BY p.scope")
    List<Object[]> aggregateByScope();

    @Query("SELECT p.category, COUNT(p) FROM ChannelPreferenceProfile p WHERE p.category IS NOT NULL GROUP BY p.category")
    List<Object[]> aggregateByCategory();

    @Query("SELECT DISTINCT p.country FROM ChannelPreferenceProfile p WHERE p.country IS NOT NULL AND p.country <> '' ORDER BY p.country")
    List<String> findDistinctCountries();

    @Query("SELECT p FROM ChannelPreferenceProfile p JOIN FETCH p.channel c WHERE p.finalTagVector IS NOT NULL AND p.finalTagVector <> ''")
    List<ChannelPreferenceProfile> findAllWithChannelAndTagVector();
}
