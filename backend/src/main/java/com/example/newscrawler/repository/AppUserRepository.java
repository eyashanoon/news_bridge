package com.example.newscrawler.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.newscrawler.entity.AppUser;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {
}
