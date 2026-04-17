package com.example.newscrawler.security;

import com.example.newscrawler.entity.Admin;
import com.example.newscrawler.entity.EditorUser;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtParser;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import com.example.newscrawler.entity.PrimitiveUser;
import com.example.newscrawler.entity.RegisteredUser;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.List;

@Component
public class JwtTokenProvider {

    @Value("${spring.security.jwt.secret:your-256-bit-secret-key-min-256-chars-long-for-production}")
    private String jwtSecret;

    @Value("${spring.security.jwt.expiration:86400000}")
    private long jwtExpiration;

    private SecretKey getSigningKey() {
        byte[] keyBytes = jwtSecret.getBytes();
        return Keys.hmacShaKeyFor(keyBytes);
    }

    public String generateTokenForPrimitiveUser(PrimitiveUser user) {
        return buildToken(user.getId().toString(), "PRIMITIVE", null, List.of("READ_ARTICLE"), user.getCreatedAt().toEpochMilli());
    }

    public String generateTokenForRegisteredUser(RegisteredUser user) {
        return buildToken(
                user.getId().toString(),
                "REGISTERED",
                user.getEmail(),
                user.getRoles() == null ? List.of() : user.getRoles().stream().map(Enum::name).toList(),
                user.getCreatedAt().toEpochMilli()
        );
    }

    public String generateTokenForEditorUser(EditorUser user) {
        return buildToken(
                user.getId().toString(),
                "REGISTERED",
                user.getEmail(),
                user.getRoles() == null ? List.of() : user.getRoles().stream().map(Enum::name).toList(),
                user.getCreatedAt().toEpochMilli()
        );
    }

    public String generateTokenForAdmin(Admin admin) {
        return buildToken(
                admin.getId().toString(),
                "ADMIN",
                admin.getEmail(),
                admin.getRoles() == null ? List.of() : admin.getRoles().stream().map(Enum::name).toList(),
                null
        );
    }

    private String buildToken(String subject, String type, String email, List<String> roles, Long createdAtMillis) {
        Date now = new Date();
        Date expiryDate = new Date(now.getTime() + jwtExpiration);

        var builder = Jwts.builder()
            .subject(subject)
            .claim("type", type)
            .claim("roles", roles)
            .issuedAt(now)
            .expiration(expiryDate)
            .signWith(getSigningKey(), SignatureAlgorithm.HS512);

        if (email != null) {
            builder.claim("email", email);
        }
        if (createdAtMillis != null) {
            builder.claim("createdAt", createdAtMillis);
        }

        return builder.compact();
    }

    public String getUserIdFromToken(String token) {
        JwtParser parser = Jwts.parser().verifyWith(getSigningKey()).build();
        Claims claims = parser.parseSignedClaims(token).getPayload();
        return claims.getSubject();
    }

    public String getTypeFromToken(String token) {
        JwtParser parser = Jwts.parser().verifyWith(getSigningKey()).build();
        Claims claims = parser.parseSignedClaims(token).getPayload();
        return claims.get("type", String.class);
    }

    public String getEmailFromToken(String token) {
        JwtParser parser = Jwts.parser().verifyWith(getSigningKey()).build();
        Claims claims = parser.parseSignedClaims(token).getPayload();
        return claims.get("email", String.class);
    }

    @SuppressWarnings("unchecked")
    public List<String> getRolesFromToken(String token) {
        JwtParser parser = Jwts.parser().verifyWith(getSigningKey()).build();
        Claims claims = parser.parseSignedClaims(token).getPayload();
        return (List<String>) claims.get("roles");
    }

    public boolean validateToken(String token) {
        try {
            JwtParser parser = Jwts.parser().verifyWith(getSigningKey()).build();
            parser.parseSignedClaims(token);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
