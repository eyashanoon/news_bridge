package com.example.newscrawler.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.newscrawler.entity.RecordStatus;
import com.example.newscrawler.entity.Root;

public interface RootRepository extends JpaRepository<Root, Long> {
	List<Root> findByNameContainingIgnoreCaseOrBaseUrlContainingIgnoreCase(String name, String baseUrl);

	List<Root> findByStatus(RecordStatus status);

	List<Root> findByStatusAndNameContainingIgnoreCaseOrStatusAndBaseUrlContainingIgnoreCase(
			RecordStatus status1,
			String name,
			RecordStatus status2,
			String baseUrl
	);

	Optional<Root> findFirstByBaseUrlContainingIgnoreCase(String domain);
}
