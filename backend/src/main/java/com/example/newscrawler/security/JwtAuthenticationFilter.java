package com.example.newscrawler.security;

import com.example.newscrawler.entity.Admin;
import com.example.newscrawler.entity.RegisteredUser;
import com.example.newscrawler.entity.UserRole;
import com.example.newscrawler.entity.UserStatus;
import com.example.newscrawler.repository.AdminRepository;
import com.example.newscrawler.repository.RegisteredUserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @Autowired
    private RegisteredUserRepository registeredUserRepository;

    @Autowired
    private AdminRepository adminRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {

        try {
            String jwt = getJwtFromRequest(request);

            if (jwt != null && jwtTokenProvider.validateToken(jwt)) {
                String userId = jwtTokenProvider.getUserIdFromToken(jwt);
                String email = jwtTokenProvider.getEmailFromToken(jwt);
                List<String> roles = jwtTokenProvider.getRolesFromToken(jwt);

                // Block suspended accounts from any action
                if (email != null && !email.isEmpty()) {
                    Admin admin = adminRepository.findByEmail(email).orElse(null);
                    if (admin != null) {
                        if (admin.getStatus() == UserStatus.SUSPENDED) {
                            response.setStatus(HttpStatus.FORBIDDEN.value());
                            response.getWriter().write("{\"error\":\"Account is suspended\"}");
                            return;
                        }
                    } else {
                        RegisteredUser user = registeredUserRepository.findByEmail(email).orElse(null);
                        if (user != null && user.getStatus() == UserStatus.SUSPENDED) {
                            response.setStatus(HttpStatus.FORBIDDEN.value());
                            response.getWriter().write("{\"error\":\"Account is suspended\"}");
                            return;
                        }
                    }
                }

                List<String> expandedRoles = new ArrayList<>(roles);
                if (roles.stream().anyMatch(r -> "OWNER".equals(r) || "ROLE_OWNER".equals(r))) {
                    for (UserRole value : UserRole.values()) {
                        expandedRoles.add(value.name());
                    }
                }

                List<SimpleGrantedAuthority> authorities = expandedRoles.stream()
                    .map(role -> new SimpleGrantedAuthority(role.startsWith("ROLE_") ? role : "ROLE_" + role))
                    .collect(Collectors.toList());

                // We can use the user's email if available, else fallback to userId as principal
                String principal = (email != null && !email.isEmpty()) ? email : userId;

                UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(principal, null, authorities);

                SecurityContextHolder.getContext().setAuthentication(authentication);
            }
        } catch (Exception ex) {
            logger.error("Could not set user authentication", ex);
        }

        filterChain.doFilter(request, response);
    }

    private String getJwtFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}
