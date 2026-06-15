package com.example.newscrawler.service;

import com.example.newscrawler.entity.AppUser;
import com.example.newscrawler.entity.UserLocation;
import com.example.newscrawler.repository.UserLocationRepository;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;

@Service
public class UserLocationService {

    private final UserLocationRepository repository;
    private final AppUserService appUserService;

    public UserLocationService(UserLocationRepository repository, AppUserService appUserService) {
        this.repository = repository;
        this.appUserService = appUserService;
    }

    public UserLocation saveLocation(String publicUserId, Map<String, Object> body) {
        AppUser user = appUserService.getOrCreateUser(publicUserId);
        UserLocation loc = repository.findByAppUserId(user.getId()).orElseGet(UserLocation::new);
        loc.setAppUser(user);
        loc.setName(stringVal(body.get("name"), "Selected Location"));
        loc.setLat(doubleVal(body.get("lat"), 0));
        loc.setLon(doubleVal(body.get("lon"), 0));
        return repository.save(loc);
    }

    public Optional<UserLocation> getLocation(String publicUserId) {
        AppUser user = appUserService.getOrCreateUser(publicUserId);
        return repository.findByAppUserId(user.getId());
    }

    private String stringVal(Object v, String fallback) {
        return v == null ? fallback : String.valueOf(v);
    }

    private double doubleVal(Object v, double fallback) {
        if (v instanceof Number n) return n.doubleValue();
        if (v instanceof String s) {
            try { return Double.parseDouble(s); } catch (NumberFormatException ignored) {}
        }
        return fallback;
    }
}
