package com.example.newscrawler.controller;

import com.example.newscrawler.dto.*;
import com.example.newscrawler.service.ChannelOnboardingService;
import com.example.newscrawler.service.ChannelProfileService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/telegram/onboarding")
public class ChannelOnboardingController {

    @Autowired
    private ChannelOnboardingService onboardingService;

    @Autowired
    private ChannelProfileService profileService;

    /** Get the next question in the decision tree given answers so far. */
    @PostMapping("/next-question")
    @PreAuthorize("hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('MANAGE_USERS')")
    public OnboardingQuestionDto nextQuestion(@RequestBody Map<String, String> answers) {
        return onboardingService.getNextQuestion(answers);
    }

    /** Get the first question (convenience endpoint). */
    @GetMapping("/start")
    @PreAuthorize("hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('MANAGE_USERS')")
    public OnboardingQuestionDto start() {
        return onboardingService.getNextQuestion(Map.of());
    }

    /** Complete onboarding for a channel — builds ChannelPreferenceProfile. */
    @PostMapping("/channels/{channelId}/complete")
    @PreAuthorize("hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('MANAGE_USERS')")
    public ChannelPreferenceProfileResponse complete(
            @PathVariable Long channelId,
            @RequestBody ChannelOnboardingRequest req) {
        return profileService.completeOnboarding(channelId, req);
    }

    @GetMapping("/channels/{channelId}/profile")
    @PreAuthorize("hasRole('MANAGE_TELEGRAM_CHANNELS') or hasRole('VIEW_TELEGRAM_POSTS') or hasRole('MANAGE_USERS')")
    public ChannelPreferenceProfileResponse getProfile(@PathVariable Long channelId) {
        return profileService.getProfile(channelId);
    }
}
