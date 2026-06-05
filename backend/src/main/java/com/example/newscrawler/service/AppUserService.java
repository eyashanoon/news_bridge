package com.example.newscrawler.service;

import com.example.newscrawler.entity.AppUser;
import com.example.newscrawler.entity.PrimitiveUser;
import com.example.newscrawler.entity.RegisteredUser;
import com.example.newscrawler.repository.AppUserRepository;
import com.example.newscrawler.repository.PrimitiveUserRepository;
import com.example.newscrawler.repository.RegisteredUserRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class AppUserService {

    private final AppUserRepository appUserRepository;
    private final PrimitiveUserRepository primitiveUserRepository;
    private final RegisteredUserRepository registeredUserRepository;

    public AppUserService(AppUserRepository appUserRepository, PrimitiveUserRepository primitiveUserRepository, RegisteredUserRepository registeredUserRepository) {
        this.appUserRepository = appUserRepository;
        this.primitiveUserRepository = primitiveUserRepository;
        this.registeredUserRepository = registeredUserRepository;
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

    public AppUser findByEmail(String email) {
        try {
            var registeredUser = registeredUserRepository.findByEmail(email);
            if (registeredUser.isPresent()) return registeredUser.get();
        } catch (Exception ignored) {}
        return null;
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
        // If the publicId is the default anonymous string, create/reuse a primitive user
        if ("android-app-anonymous".equals(publicId) || "anonymous".equals(publicId)) {
            PrimitiveUser newUser = new PrimitiveUser();
            return primitiveUserRepository.save(newUser);
        }
        
        try {
            Long id = Long.parseLong(publicId);
            return appUserRepository.findById(id)
                    .orElseGet(() -> {
                        PrimitiveUser newUser = new PrimitiveUser();
                        return primitiveUserRepository.save(newUser);
                    });
        } catch (NumberFormatException e) {
            throw new RuntimeException("Invalid User ID format");
        }
    }
}
