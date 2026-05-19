package com.example.newscrawler.controller;

import com.example.newscrawler.entity.AppUser;
import com.example.newscrawler.entity.UserPreference;
import com.example.newscrawler.repository.UserPreferenceRepository;
import com.example.newscrawler.service.AppUserService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class UserPreferenceController {

    private final UserPreferenceRepository preferenceRepository;
    private final AppUserService appUserService;

    public UserPreferenceController(UserPreferenceRepository preferenceRepository,
                                    AppUserService appUserService) {
        this.preferenceRepository = preferenceRepository;
        this.appUserService = appUserService;
    }

    @GetMapping("/users/{userId}/preferences")
    public ResponseEntity<List<Map<String, Object>>> getUserPreferences(@PathVariable String userId) {
        AppUser appUser = appUserService.getOrCreateUser(userId);
        List<UserPreference> prefs = preferenceRepository.findTop20ByAppUserIdOrderByWeightDesc(appUser.getId());

        List<Map<String, Object>> result = prefs.stream()
                .map(p -> Map.<String, Object>of(
                        "tag", p.getTag(),
                        "weight", p.getWeight()
                ))
                .collect(Collectors.toList());

        return ResponseEntity.ok(result);
    }
}