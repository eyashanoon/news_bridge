package com.example.newscrawler.controller;

import com.example.newscrawler.dto.RegisteredUserDto;
import com.example.newscrawler.entity.RegisteredUser;
import com.example.newscrawler.repository.RegisteredUserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/users/registered")
public class RegisteredUserController {

    @Autowired
    private RegisteredUserRepository registeredUserRepository;

    @GetMapping
    @PreAuthorize("hasRole('MANAGE_USERS')")
    public List<RegisteredUserDto> getAll() {
        return registeredUserRepository.findAll().stream()
            .map(this::mapToDto)
            .collect(Collectors.toList());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('MANAGE_USERS')")
    public RegisteredUserDto getById(@PathVariable Long id) {
        RegisteredUser u = registeredUserRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return mapToDto(u);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('MANAGE_USERS')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        registeredUserRepository.deleteById(id);
    }

    @GetMapping("/me")
    public RegisteredUserDto getMe() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        RegisteredUser u = registeredUserRepository.findByEmail(email)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return mapToDto(u);
    }

    private RegisteredUserDto mapToDto(RegisteredUser user) {
        RegisteredUserDto dto = new RegisteredUserDto();
        dto.id = user.getId();
        dto.username = user.getUsername();
        dto.email = user.getEmail();
        dto.status = user.getStatus();
        return dto;
    }
}
