package com.example.newscrawler.controller;

import com.example.newscrawler.entity.UserLocation;
import com.example.newscrawler.service.UserLocationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/user")
@CrossOrigin(origins = "*")
public class UserLocationController {

    private final UserLocationService userLocationService;

    public UserLocationController(UserLocationService userLocationService) {
        this.userLocationService = userLocationService;
    }

    @PostMapping("/{userId}/location")
    public ResponseEntity<Map<String, Object>> saveLocation(
            @PathVariable String userId,
            @RequestBody Map<String, Object> body
    ) {
        UserLocation saved = userLocationService.saveLocation(userId, body);
        return ResponseEntity.ok(Map.of(
                "name", saved.getName(),
                "lat", saved.getLat(),
                "lon", saved.getLon()
        ));
    }

    @GetMapping("/{userId}/location")
    public ResponseEntity<Map<String, Object>> getLocation(@PathVariable String userId) {
        Optional<UserLocation> loc = userLocationService.getLocation(userId);
        if (loc.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        UserLocation saved = loc.get();
        return ResponseEntity.ok(Map.of(
                "name", saved.getName(),
                "lat", saved.getLat(),
                "lon", saved.getLon()
        ));
    }
}
