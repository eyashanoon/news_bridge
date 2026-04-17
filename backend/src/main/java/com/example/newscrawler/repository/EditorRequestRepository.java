package com.example.newscrawler.repository;

import com.example.newscrawler.entity.EditorRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EditorRequestRepository extends JpaRepository<EditorRequest, Long> {
    List<EditorRequest> findByUserEmail(String email);

    long countByStatus(String status);

    @Query("SELECT r FROM EditorRequest r LEFT JOIN FETCH r.field ORDER BY r.field.name ASC")
    List<EditorRequest> findAllOrderByFieldNameAsc();
}
