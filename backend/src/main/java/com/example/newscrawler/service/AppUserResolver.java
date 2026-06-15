package com.example.newscrawler.service;

import com.example.newscrawler.entity.AppUser;
import com.example.newscrawler.security.JwtTokenProvider;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AppUserResolver {

    private final AppUserService appUserService;
    private final JwtTokenProvider jwtTokenProvider;

    public AppUserResolver(AppUserService appUserService, JwtTokenProvider jwtTokenProvider) {
        this.appUserService = appUserService;
        this.jwtTokenProvider = jwtTokenProvider;
    }

    /**
     * Resolve the acting user for feed/reaction endpoints.
     * Prefer the authenticated JWT subject so likes stay tied to the same account on refresh.
     */
    public AppUser resolve(HttpServletRequest request, String userIdParam) {
        String jwt = extractBearerToken(request);
        if (jwt != null && jwtTokenProvider.validateToken(jwt)) {
            String jwtUserId = jwtTokenProvider.getUserIdFromToken(jwt);
            return appUserService.requireUser(jwtUserId);
        }

        if (userIdParam != null && !userIdParam.isBlank()) {
            return appUserService.getOrCreateUser(userIdParam);
        }

        throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User identification required");
    }

    private static String extractBearerToken(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (bearerToken != null && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}
