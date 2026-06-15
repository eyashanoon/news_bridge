package com.example.newscrawler.service;

import com.example.newscrawler.entity.*;
import com.example.newscrawler.repository.*;
import com.example.newscrawler.util.TagVectorUtils;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Service
public class ChannelTaggingService {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final ChannelTagRepository channelTagRepo;
    private final TelegramPostRepository telegramPostRepo;
    private final RestTemplate restTemplate;

    @Value("${tag.service.base-url:http://localhost:8001}")
    private String tagServiceBaseUrl;

    public ChannelTaggingService(ChannelTagRepository channelTagRepo,
                                   TelegramPostRepository telegramPostRepo) {
        this.channelTagRepo = channelTagRepo;
        this.telegramPostRepo = telegramPostRepo;
        this.restTemplate = new RestTemplate();
    }

    /** Extract tags from arbitrary text via tag service (used for Telegram posts). */
    public List<String> extractTagsFromText(String text) {
        if (text == null || text.isBlank()) return List.of();
        return callTagService(text);
    }

    /** Extract tags from admin description via tag service (medium-high weight). */
    public Map<String, Double> tagsFromDescription(String description) {
        if (description == null || description.isBlank()) return Map.of();
        List<String> raw = callTagService(description);
        Map<String, Double> vec = new LinkedHashMap<>();
        double w = 0.9;
        for (String tag : raw) {
            vec.put(tag.toLowerCase(), w);
            w = Math.max(0.5, w - 0.05);
        }
        return vec;
    }

    /** Extract tags from last N posts (dynamic weight based on recency). */
    public Map<String, Double> tagsFromRecentPosts(TelegramChannel channel, int maxPosts) {
        var page = telegramPostRepo.findByChannel_Id(
                channel.getId(),
                org.springframework.data.domain.PageRequest.of(
                        0, maxPosts,
                        org.springframework.data.domain.Sort.by(
                                org.springframework.data.domain.Sort.Direction.DESC, "messageDate"))
        );
        Map<String, Double> aggregated = new LinkedHashMap<>();
        int idx = 0;
        for (TelegramPost post : page.getContent()) {
            double recencyWeight = 1.0 - (idx * 0.01);
            String text = post.getContent();
            if (text == null || text.isBlank()) continue;
            List<String> tags = callTagService(text);
            for (String tag : tags) {
                aggregated.merge(tag.toLowerCase(), recencyWeight * 0.7, Double::sum);
            }
            idx++;
        }
        return TagVectorUtils.normalize(aggregated);
    }

    public void persistChannelTags(TelegramChannel channel, Map<String, Double> descTags,
                                    Map<String, Double> postTags, Map<String, Double> questionnaireTags) {
        channelTagRepo.deleteByChannel_Id(channel.getId());
        saveTags(channel, questionnaireTags, ChannelTag.TagSource.QUESTIONNAIRE, 1.0);
        saveTags(channel, descTags, ChannelTag.TagSource.ADMIN_DESC, 0.85);
        saveTags(channel, postTags, ChannelTag.TagSource.POSTS, 0.7);
    }

    private void saveTags(TelegramChannel channel, Map<String, Double> tags,
                          ChannelTag.TagSource source, double sourceScale) {
        for (var e : tags.entrySet()) {
            ChannelTag ct = new ChannelTag();
            ct.setChannel(channel);
            ct.setTag(e.getKey());
            ct.setWeight(e.getValue() * sourceScale);
            ct.setSource(source);
            channelTagRepo.save(ct);
        }
    }

    @SuppressWarnings("unchecked")
    private List<String> callTagService(String text) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            Map<String, String> body = Map.of("text", text.substring(0, Math.min(text.length(), 5000)));
            ResponseEntity<Map> resp = restTemplate.postForEntity(
                    tagServiceBaseUrl + "/extract-tags",
                    new HttpEntity<>(body, headers),
                    Map.class
            );
            if (resp.getBody() != null && resp.getBody().get("tags") instanceof List<?> list) {
                List<String> tags = new ArrayList<>();
                for (Object item : list) {
                    if (item instanceof Map<?, ?> m && m.get("tag") != null) {
                        tags.add(m.get("tag").toString());
                    } else if (item instanceof String s) {
                        tags.add(s);
                    }
                }
                return tags;
            }
        } catch (Exception ignored) {
            // Fallback: simple keyword extraction
        }
        return fallbackKeywords(text);
    }

    private List<String> fallbackKeywords(String text) {
        Set<String> stop = Set.of("the", "and", "for", "with", "this", "that", "from", "are", "was");
        List<String> result = new ArrayList<>();
        for (String w : text.toLowerCase().split("\\W+")) {
            if (w.length() > 3 && !stop.contains(w) && result.size() < 10) {
                result.add(w);
            }
        }
        return result;
    }

    public Map<String, Double> buildFinalTagVector(Map<String, Double> questionnaire,
                                                    Map<String, Double> descTags,
                                                    Map<String, Double> postTags) {
        return TagVectorUtils.fuseChannelProfile(questionnaire, postTags, descTags);
    }
}
