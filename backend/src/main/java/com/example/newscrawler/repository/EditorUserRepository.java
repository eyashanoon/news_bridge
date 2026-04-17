package com.example.newscrawler.repository;

import com.example.newscrawler.entity.EditorUser;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EditorUserRepository extends JpaRepository<EditorUser, Long> {
	Optional<EditorUser> findByEmail(String email);
}
