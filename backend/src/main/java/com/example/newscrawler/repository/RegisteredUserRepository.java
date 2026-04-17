package com.example.newscrawler.repository;

import com.example.newscrawler.entity.RegisteredUser;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RegisteredUserRepository extends JpaRepository<RegisteredUser, Long> {
    Optional<RegisteredUser> findByEmail(String email);
    boolean existsByEmail(String email);
}
