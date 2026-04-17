package com.example.newscrawler.repository;

import com.example.newscrawler.entity.PrimitiveUser;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PrimitiveUserRepository extends JpaRepository<PrimitiveUser, Long> {
}
