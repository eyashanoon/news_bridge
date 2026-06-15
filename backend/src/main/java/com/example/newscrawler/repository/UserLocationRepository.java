package com.example.newscrawler.repository;

import com.example.newscrawler.entity.UserLocation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserLocationRepository extends JpaRepository<UserLocation, Long> {
    Optional<UserLocation> findByAppUserId(Long appUserId);
}
