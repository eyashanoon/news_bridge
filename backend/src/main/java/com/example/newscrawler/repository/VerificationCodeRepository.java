package com.example.newscrawler.repository;

import com.example.newscrawler.entity.VerificationCode;
import com.example.newscrawler.entity.VerificationType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VerificationCodeRepository extends JpaRepository<VerificationCode, Long> {
    Optional<VerificationCode> findTopByEmailAndCodeAndTypeAndUsedFalseOrderByCreatedAtDesc(
        String email, String code, VerificationType type
    );
    void deleteByEmail(String email);
}