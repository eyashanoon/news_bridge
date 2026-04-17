package com.example.newscrawler.repository;

import com.example.newscrawler.entity.Admin;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdminRepository extends JpaRepository<Admin, Long> {
    Optional<Admin> findByEmail(String email);
    boolean existsByEmail(String email);
}
