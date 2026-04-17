package com.example.newscrawler.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.newscrawler.entity.RecordStatus;
import com.example.newscrawler.entity.Endpoint;

public interface EndpointRepository extends JpaRepository<Endpoint, Long> {
    boolean existsByUrl(String url);

    boolean existsByUrlAndIdNot(String url, Long id);

    List<Endpoint> findByRootId(Long rootId);

    List<Endpoint> findByRootIdAndStatus(Long rootId, RecordStatus status);

    List<Endpoint> findByUrlContainingIgnoreCase(String search);

    List<Endpoint> findByStatusAndUrlContainingIgnoreCase(RecordStatus status, String search);

    List<Endpoint> findByRootIdAndUrlContainingIgnoreCase(Long rootId, String search);

    List<Endpoint> findByRootIdAndStatusAndUrlContainingIgnoreCase(Long rootId, RecordStatus status, String search);
}
