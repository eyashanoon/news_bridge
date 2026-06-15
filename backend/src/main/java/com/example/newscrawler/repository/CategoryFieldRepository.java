package com.example.newscrawler.repository;

import com.example.newscrawler.entity.CategoryField;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface CategoryFieldRepository extends JpaRepository<CategoryField, Long> {
    @Query("SELECT DISTINCT f FROM CategoryField f LEFT JOIN FETCH f.children WHERE f.parent IS NULL ORDER BY f.name ASC")
    List<CategoryField> findByParentIsNullWithChildren();
    
    List<CategoryField> findByParentIsNull();
}
