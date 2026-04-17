package com.example.newscrawler.repository;

import com.example.newscrawler.entity.UserPreference;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UserPreferenceRepository extends JpaRepository<UserPreference, Long> {

    Optional<UserPreference> findByAppUserIdAndTag(Long appUserId, String tag);

    List<UserPreference> findTop20ByAppUserIdOrderByWeightDesc(Long appUserId);
}
