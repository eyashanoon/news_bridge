package com.example.newscrawler.controller;

import com.example.newscrawler.entity.PrimitiveUser;
import com.example.newscrawler.entity.UserStatus;
import com.example.newscrawler.repository.PrimitiveUserRepository;
import com.example.newscrawler.security.JwtTokenProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/primitive-users")
public class PrimitiveUserController {

    @Autowired
    private PrimitiveUserRepository primitiveUserRepository;

    @Autowired
    private JwtTokenProvider jwtTokenProvider;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> createPrimitiveUser() {
        PrimitiveUser primitiveUser = new PrimitiveUser();
        primitiveUser.setStatus(UserStatus.ACTIVE);

        primitiveUser = primitiveUserRepository.save(primitiveUser);

        String jwtToken = jwtTokenProvider.generateTokenForPrimitiveUser(primitiveUser);
        
        return Map.of("token", jwtToken);
    }
}
