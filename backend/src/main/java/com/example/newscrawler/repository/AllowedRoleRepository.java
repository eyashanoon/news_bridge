package com.example.newscrawler.repository;

import com.example.newscrawler.entity.AllowedRole;
import com.example.newscrawler.entity.UserRole;
import com.example.newscrawler.entity.UserType;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface AllowedRoleRepository extends JpaRepository<AllowedRole, Long> {
    List<AllowedRole> findByUserType(UserType userType);
    Optional<AllowedRole> findByUserTypeAndRole(UserType userType, UserRole role);
    boolean existsByUserTypeAndRole(UserType userType, UserRole role);
}
