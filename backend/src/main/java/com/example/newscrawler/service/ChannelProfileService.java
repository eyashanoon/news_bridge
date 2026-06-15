package com.example.newscrawler.service;

import com.example.newscrawler.dto.*;
import com.example.newscrawler.entity.*;
import com.example.newscrawler.repository.*;
import com.example.newscrawler.util.TagVectorUtils;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;

@Service
public class ChannelProfileService {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final ChannelPreferenceProfileRepository profileRepo;
    private final TelegramChannelRepository channelRepo;
    private final ChannelOnboardingService onboardingService;
    private final ChannelTaggingService taggingService;
    private final TelegramPostRepository postRepo;

    public ChannelProfileService(ChannelPreferenceProfileRepository profileRepo,
                                 TelegramChannelRepository channelRepo,
                                 ChannelOnboardingService onboardingService,
                                 ChannelTaggingService taggingService,
                                 TelegramPostRepository postRepo) {
        this.profileRepo = profileRepo;
        this.channelRepo = channelRepo;
        this.onboardingService = onboardingService;
        this.taggingService = taggingService;
        this.postRepo = postRepo;
    }

    @Transactional
    public ChannelPreferenceProfileResponse completeOnboarding(Long channelId, ChannelOnboardingRequest req) {
        TelegramChannel channel = channelRepo.findById(channelId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Channel not found"));

        if (req.adminDescription == null || req.adminDescription.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Admin description (3–5 lines) is required");
        }
        if (req.answers == null || req.answers.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Questionnaire answers required");
        }

        var intentResult = onboardingService.buildIntentFromAnswers(req.answers);
        Map<String, Double> questionnaireVec = intentResult.intentVector();
        Map<String, Double> descTags = taggingService.tagsFromDescription(req.adminDescription);
        Map<String, Double> postTags = taggingService.tagsFromRecentPosts(channel, 50);
        Map<String, Double> fused = taggingService.buildFinalTagVector(questionnaireVec, descTags, postTags);

        ChannelPreferenceProfile profile = profileRepo.findByChannel_Id(channelId)
                .orElse(new ChannelPreferenceProfile());
        profile.setChannel(channel);
        profile.setAdminDescription(req.adminDescription.trim());
        profile.setCategoryTreePath(onboardingService.pathToJson(intentResult.categoryPath()));
        profile.setQuestionnaireIntentVector(TagVectorUtils.toJson(questionnaireVec));
        profile.setDescriptionTagVector(TagVectorUtils.toJson(descTags));
        profile.setPostTagVector(TagVectorUtils.toJson(postTags));
        profile.setFinalTagVector(TagVectorUtils.toJson(fused));
        profile.setDescriptionEmbedding(TagVectorUtils.tagsToEmbeddingJson(descTags, 768));
        profile.setCombinedEmbedding(TagVectorUtils.tagsToEmbeddingJson(fused, 768));
        profile.setBehavioralSignals(buildBehavioralJson(channel));
        profile.setOnboardingCompleted(true);
        try {
            profile.setOnboardingAnswers(MAPPER.writeValueAsString(req.answers));
        } catch (Exception e) {
            profile.setOnboardingAnswers("{}");
        }
        applyDenormalizedProfileFields(profile, req.answers, intentResult.categoryPath());
        profileRepo.save(profile);

        taggingService.persistChannelTags(channel, descTags, postTags, questionnaireVec);
        channel.setOnboardingCompleted(true);
        channelRepo.save(channel);

        return toResponse(profile);
    }

    @Transactional
    public void refreshPostTags(Long channelId) {
        TelegramChannel channel = channelRepo.findById(channelId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Channel not found"));
        ChannelPreferenceProfile profile = profileRepo.findByChannel_Id(channelId).orElse(null);
        if (profile == null) return;

        Map<String, Double> questionnaireVec = TagVectorUtils.parseVector(profile.getQuestionnaireIntentVector());
        Map<String, Double> descTags = TagVectorUtils.parseVector(profile.getDescriptionTagVector());
        Map<String, Double> postTags = taggingService.tagsFromRecentPosts(channel, 100);
        Map<String, Double> fused = taggingService.buildFinalTagVector(questionnaireVec, descTags, postTags);

        profile.setPostTagVector(TagVectorUtils.toJson(postTags));
        profile.setFinalTagVector(TagVectorUtils.toJson(fused));
        profile.setCombinedEmbedding(TagVectorUtils.tagsToEmbeddingJson(fused, 768));
        profile.setBehavioralSignals(buildBehavioralJson(channel));
        profileRepo.save(profile);
        taggingService.persistChannelTags(channel, descTags, postTags, questionnaireVec);
    }

    public ChannelPreferenceProfileResponse getProfile(Long channelId) {
        return profileRepo.findByChannel_Id(channelId)
                .map(this::toResponse)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Profile not found"));
    }

    private String buildBehavioralJson(TelegramChannel channel) {
        Map<String, Object> signals = new LinkedHashMap<>();
        signals.put("postFrequency", channel.getPostFrequency());
        signals.put("avgViews", channel.getAvgViewCount());
        signals.put("totalPosts", channel.getTotalPostsCollected());
        signals.put("lastCrawledAt", channel.getLastCrawledAt() != null ? channel.getLastCrawledAt().toString() : null);
        signals.put("crawlScore", channel.getCrawlScore());
        try {
            return MAPPER.writeValueAsString(signals);
        } catch (Exception e) {
            return "{}";
        }
    }

    private void applyDenormalizedProfileFields(ChannelPreferenceProfile profile,
                                                Map<String, String> answers,
                                                List<String> categoryPath) {
        String purpose = answers.getOrDefault("q1_purpose", "").toLowerCase();
        profile.setPurpose(purpose.isBlank() ? null : purpose);
        profile.setCategory(categoryPath.isEmpty() ? null : categoryPath.get(0));

        if ("news".equals(purpose)) {
            String scope = answers.getOrDefault("q2_news_scope", "");
            profile.setScope(scope.isBlank() ? null : scope);
            if ("local".equals(scope)) {
                profile.setCountry(blankToNull(answers.get("q3_local_country")));
            } else {
                profile.setScope("international");
                profile.setCountry(blankToNull(answers.get("q3_intl_region")));
            }
        } else if (!purpose.isBlank()) {
            profile.setScope("general");
        }
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private ChannelPreferenceProfileResponse toResponse(ChannelPreferenceProfile p) {
        ChannelPreferenceProfileResponse r = new ChannelPreferenceProfileResponse();
        r.channelId = p.getChannel().getId();
        r.adminDescription = p.getAdminDescription();
        r.categoryTreePath = p.getCategoryTreePath();
        r.finalTagVector = p.getFinalTagVector();
        r.onboardingCompleted = p.isOnboardingCompleted();
        r.updatedAt = p.getUpdatedAt();
        return r;
    }
}
