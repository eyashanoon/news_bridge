package com.example.newscrawler.service;

import com.example.newscrawler.dto.ProfileQualityDto;
import com.example.newscrawler.entity.ChannelPreferenceProfile;
import com.example.newscrawler.entity.TelegramChannel;
import com.example.newscrawler.util.TagVectorUtils;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class TelegramProfileQualityService {

    public ProfileQualityDto compute(TelegramChannel channel, ChannelPreferenceProfile profile) {
        ProfileQualityDto dto = new ProfileQualityDto();
        dto.missingFields = new ArrayList<>();

        double completion = 0.0;
        if (channel.isOnboardingCompleted()) completion += 25;
        else dto.missingFields.add("onboarding");

        if (profile != null && profile.getAdminDescription() != null && profile.getAdminDescription().length() > 50) {
            completion += 20;
        } else {
            dto.missingFields.add("description");
        }

        if (profile != null && profile.getOnboardingAnswers() != null && !profile.getOnboardingAnswers().isBlank()
                && !"{}".equals(profile.getOnboardingAnswers())) {
            completion += 25;
        } else {
            dto.missingFields.add("questionnaire");
        }

        Map<String, Double> postVec = profile != null
                ? TagVectorUtils.parseVector(profile.getPostTagVector()) : Map.of();
        if (!postVec.isEmpty()) completion += 15;
        else dto.missingFields.add("post_tags");

        if (channel.getAvatarUrl() != null && !channel.getAvatarUrl().isBlank()) completion += 5;
        else dto.missingFields.add("avatar");

        if (profile != null && profile.getBehavioralSignals() != null && !profile.getBehavioralSignals().isBlank()) {
            completion += 10;
        } else {
            dto.missingFields.add("behavioral_signals");
        }

        dto.completionPercent = completion;

        double qMag = magnitude(profile != null ? profile.getQuestionnaireIntentVector() : null);
        double dMag = magnitude(profile != null ? profile.getDescriptionTagVector() : null);
        double pMag = magnitude(profile != null ? profile.getPostTagVector() : null);
        double total = qMag + dMag + pMag;
        if (total > 0) {
            dto.questionnaireContribution = round(qMag / total);
            dto.descriptionContribution = round(dMag / total);
            dto.postContribution = round(pMag / total);
        }
        dto.confidenceScore = round(Math.min(1.0, 0.4 * qMag + 0.3 * dMag + 0.3 * pMag));
        return dto;
    }

    private static double magnitude(String json) {
        return TagVectorUtils.parseVector(json).values().stream().mapToDouble(Double::doubleValue).sum();
    }

    private static double round(double v) {
        return Math.round(v * 1000.0) / 1000.0;
    }
}
