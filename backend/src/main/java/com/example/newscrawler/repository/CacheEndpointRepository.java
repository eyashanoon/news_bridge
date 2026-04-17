package com.example.newscrawler.repository;

import com.example.newscrawler.entity.CacheEndpoint;
import com.example.newscrawler.entity.AnalysisResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CacheEndpointRepository extends JpaRepository<CacheEndpoint, Long> {
    Optional<CacheEndpoint> findBySourceEndpointIdAndUrl(Long sourceEndpointId, String url);

    boolean existsBySourceEndpointIdAndUrl(Long sourceEndpointId, String url);
    
    // Find latest cache entry for a given source endpoint and URL (handles duplicates)
    java.util.List<CacheEndpoint> findBySourceEndpointIdAndUrlOrderByCreatedAtDesc(Long sourceEndpointId, String url);
    
    List<CacheEndpoint> findBySourceEndpointId(Long endpointId);
    
    List<CacheEndpoint> findByResult(AnalysisResult result);
}
