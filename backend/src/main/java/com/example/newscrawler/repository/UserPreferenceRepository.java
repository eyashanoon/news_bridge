package com.example.newscrawler.repository;

import com.example.newscrawler.entity.UserPreference;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserPreferenceRepository extends JpaRepository<UserPreference, Long> {

    Optional<UserPreference> findByAppUserIdAndTag(Long appUserId, String tag);

    List<UserPreference> findTop20ByAppUserIdOrderByWeightDesc(Long appUserId);

    @org.springframework.data.jpa.repository.Query("""
        SELECT up.tag, AVG(up.weight), COUNT(DISTINCT up.appUser.id)
        FROM UserPreference up
        GROUP BY up.tag
        ORDER BY AVG(up.weight) DESC
        """)
    List<Object[]> aggregateTopTags();

    @org.springframework.data.jpa.repository.Query("""
        SELECT up.appUser.id, up.tag, up.weight
        FROM UserPreference up
        WHERE up.weight > 0
        ORDER BY up.appUser.id, up.weight DESC
        """)
    List<Object[]> findAllWeightedPreferences();

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(DISTINCT up.appUser.id) FROM UserPreference up")
    long countDistinctUsers();

    long countByAppUserId(Long appUserId);
}
