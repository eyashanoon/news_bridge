package com.example.newscrawler.controller;

import com.example.newscrawler.dto.LoginRequest;
import com.example.newscrawler.dto.LoginResponse;
import com.example.newscrawler.entity.Admin;
import com.example.newscrawler.entity.UserStatus;
import com.example.newscrawler.repository.AdminRepository;
import com.example.newscrawler.security.JwtTokenProvider;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.util.List;

@RestController
@RequestMapping("/auth/admin")
public class AdminAuthController {
    private static final Logger logger = LoggerFactory.getLogger(AdminAuthController.class);

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private AdminRepository adminRepository;

    @PostMapping("/login")
    @ResponseStatus(HttpStatus.OK)
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        logger.info("Admin Login attempt for email: {}", request.email());

        try {
            authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.email(), request.password())
            );

            Admin admin = adminRepository.findByEmail(request.email())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Admin not found"));

            if (admin.getStatus() == UserStatus.SUSPENDED) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin account suspended");
            }
            if (admin.getStatus() == UserStatus.PENDING_ACTIVATION) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Admin account pending activation");
            }

            String adminToken = jwtTokenProvider.generateTokenForAdmin(admin);
            List<String> adminRoles = admin.getRoles().stream().map(Enum::name).toList();
            return new LoginResponse(adminToken, admin.getEmail(), adminRoles);
        } catch (ResponseStatusException rse) {
            throw rse;
        } catch (Exception e) {
            logger.error("Admin Authentication failed for {}: {}", request.email(), e.getMessage(), e);
            throw new ResponseStatusException(
                HttpStatus.UNAUTHORIZED,
                "Invalid admin credentials"
            );
        }
    }
}
