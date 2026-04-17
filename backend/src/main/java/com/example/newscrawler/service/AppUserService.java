package com.example.newscrawler.service;

import com.example.newscrawler.entity.AppUser;
import com.example.newscrawler.repository.AppUserRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class AppUserService {

    private final AppUserRepository appUserRepository;

    public AppUserService(AppUserRepository appUserRepository) {
        this.appUserRepository = appUserRepository;
    }

    public List<AppUser> findAll() {
        return appUserRepository.findAll();
    }

    public Optional<AppUser> findById(Long id) {
        return appUserRepository.findById(id);
    }
    
    public void delete(Long id) {
        appUserRepository.deleteById(id);
    }

    public AppUser getUserById(String publicId) {
        try {
            Long id = Long.parseLong(publicId);
            return appUserRepository.findById(id)
                    .orElseThrow(() -> new RuntimeException("User not found"));
        } catch (NumberFormatException e) {
            throw new RuntimeException("Invalid User ID format");
        }
    }
    
    public AppUser getOrCreateUser(String publicId) {
        // Just return the existing user based on publicId for now
        return getUserById(publicId);
    }
}
