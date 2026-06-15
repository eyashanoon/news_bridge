package com.example.newscrawler.repository;

import com.example.newscrawler.entity.SavedCollection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SavedCollectionRepository extends JpaRepository<SavedCollection, Long> {

    List<SavedCollection> findByAppUserIdOrderByCreatedAtAsc(Long appUserId);

    Optional<SavedCollection> findByAppUserIdAndExternalId(Long appUserId, String externalId);

    void deleteByAppUserIdAndExternalId(Long appUserId, String externalId);
}
