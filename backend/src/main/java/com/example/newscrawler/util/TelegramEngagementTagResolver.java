package com.example.newscrawler.util;

import com.example.newscrawler.entity.ChannelPreferenceProfile;
import com.example.newscrawler.entity.TelegramPost;
import com.example.newscrawler.entity.TelegramPostTag;
import com.example.newscrawler.repository.ChannelPreferenceProfileRepository;
import com.example.newscrawler.repository.TelegramPostRepository;
import com.example.newscrawler.repository.TelegramPostTagRepository;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Resolves topic/tag vectors for Telegram engagement signals (views, read time).
 */
public final class TelegramEngagementTagResolver {

    private static final Pattern HASHTAG = Pattern.compile("#([\\w\\u0600-\\u06FF]+)");

    private TelegramEngagementTagResolver() {}

    public static Map<String, Double> resolve(
            ChannelPreferenceProfileRepository profileRepo,
            TelegramPostTagRepository postTagRepo,
            TelegramPostRepository postRepo,
            Long channelId,
            Long postId) {

        if (channelId != null) {
            Optional<ChannelPreferenceProfile> profile = profileRepo.findByChannel_Id(channelId);
            if (profile.isPresent()) {
                Map<String, Double> vec = TagVectorUtils.parseVector(profile.get().getFinalTagVector());
                if (!vec.isEmpty()) return vec;
            }
        }

        if (postId != null) {
            Map<String, Double> fromTags = fromPostTags(postTagRepo, postId);
            if (!fromTags.isEmpty()) return fromTags;

            Map<String, Double> fromContent = postRepo.findById(postId)
                    .map(TelegramPost::getContent)
                    .map(TelegramEngagementTagResolver::fromContentHashtags)
                    .orElse(Map.of());
            if (!fromContent.isEmpty()) return fromContent;
        }

        if (channelId != null) {
            return profileRepo.findByChannel_Id(channelId)
                    .map(TelegramEngagementTagResolver::fromProfileMetadata)
                    .orElse(Map.of());
        }

        return Map.of();
    }

    public static Map<String, Double> parseSnapshot(String tagSnapshot) {
        if (tagSnapshot == null || tagSnapshot.isBlank()) return Map.of();
        Map<String, Double> vec = TagVectorUtils.parseVector(tagSnapshot);
        return vec.isEmpty() ? Map.of() : vec;
    }

    public static String toSnapshot(Map<String, Double> vec) {
        if (vec == null || vec.isEmpty()) return null;
        return TagVectorUtils.toJson(vec);
    }

    private static Map<String, Double> fromPostTags(TelegramPostTagRepository postTagRepo, Long postId) {
        Map<String, Double> vec = new HashMap<>();
        for (TelegramPostTag tag : postTagRepo.findByTelegramPost_Id(postId)) {
            if (tag.getTag() != null && !tag.getTag().isBlank()) {
                vec.put(tag.getTag().toLowerCase(), 1.0);
            }
        }
        return vec.isEmpty() ? Map.of() : TagVectorUtils.normalize(vec);
    }

    public static Map<String, Double> fromContentHashtags(String content) {
        if (content == null || content.isBlank()) return Map.of();
        Map<String, Double> vec = new HashMap<>();
        Matcher matcher = HASHTAG.matcher(content);
        while (matcher.find()) {
            String tag = matcher.group(1).toLowerCase();
            if (!tag.isBlank()) vec.put(tag, 1.0);
        }
        return vec.isEmpty() ? Map.of() : TagVectorUtils.normalize(vec);
    }

    private static Map<String, Double> fromProfileMetadata(ChannelPreferenceProfile profile) {
        Map<String, Double> vec = new HashMap<>();
        if (profile.getCategory() != null && !profile.getCategory().isBlank()) {
            vec.put(profile.getCategory().toLowerCase(), 1.0);
        }
        if (profile.getCountry() != null && !profile.getCountry().isBlank()) {
            vec.put("region:" + profile.getCountry().toLowerCase(), 1.0);
        }
        if (profile.getCategoryTreePath() != null) {
            String path = profile.getCategoryTreePath()
                    .replace("[", "").replace("]", "").replace("\"", "");
            for (String part : path.split(",")) {
                String token = part.trim().toLowerCase();
                if (!token.isBlank()) vec.put(token, 1.0);
            }
        }
        Map<String, Double> postTags = TagVectorUtils.parseVector(profile.getPostTagVector());
        postTags.forEach((k, v) -> vec.merge(k.toLowerCase(), v, Double::sum));
        return vec.isEmpty() ? Map.of() : TagVectorUtils.normalize(vec);
    }
}
