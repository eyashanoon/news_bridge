package com.example.newscrawler.service;

import com.example.newscrawler.entity.AppUser;
import com.example.newscrawler.entity.PrimitiveUser;
import com.example.newscrawler.entity.RegisteredUser;
import com.example.newscrawler.repository.AppUserRepository;
import com.example.newscrawler.repository.PrimitiveUserRepository;
import com.example.newscrawler.repository.RegisteredUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

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
        return requireUser(publicId);
    }

    public AppUser requireUser(String publicId) {
        try {
            Long id = Long.parseLong(publicId);
            return appUserRepository.findById(id)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
        } catch (NumberFormatException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid user ID format");
        }
    }
    
    public AppUser getOrCreateUser(String publicId) {
        if ("android-app-anonymous".equals(publicId) || "anonymous".equals(publicId)) {
            PrimitiveUser newUser = new PrimitiveUser();
            return primitiveUserRepository.save(newUser);
        }

        return requireUser(publicId);
    }
}
