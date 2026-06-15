package com.example.newscrawler.service;

import com.example.newscrawler.dto.LabelCountDto;
import com.example.newscrawler.dto.TelegramRecommendationInsightsDto;
import com.example.newscrawler.dto.TelegramSimilarityGraphDto;
import com.example.newscrawler.entity.ChannelPreferenceProfile;
import com.example.newscrawler.entity.TelegramChannel;
import com.example.newscrawler.repository.ChannelPreferenceProfileRepository;
import com.example.newscrawler.repository.TelegramChannelRepository;
import com.example.newscrawler.repository.TelegramEngagementEventRepository;
import com.example.newscrawler.repository.TelegramPostTagRepository;
import com.example.newscrawler.util.TagVectorUtils;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class TelegramRecommendationInsightsService {

    private static final double SIMILARITY_THRESHOLD = 0.35;

    private final ChannelPreferenceProfileRepository profileRepo;
    private final TelegramChannelRepository channelRepo;
    private final TelegramEngagementEventRepository engagementRepo;
    private final TelegramPostTagRepository postTagRepo;

    public TelegramRecommendationInsightsService(ChannelPreferenceProfileRepository profileRepo,
                                                   TelegramChannelRepository channelRepo,
                                                   TelegramEngagementEventRepository engagementRepo,
                                                   TelegramPostTagRepository postTagRepo) {
        this.profileRepo = profileRepo;
        this.channelRepo = channelRepo;
        this.engagementRepo = engagementRepo;
        this.postTagRepo = postTagRepo;
    }

    @Transactional(readOnly = true)
    public TelegramRecommendationInsightsDto getInsights() {
        Instant since = Instant.now().minus(30, ChronoUnit.DAYS);
        TelegramRecommendationInsightsDto dto = new TelegramRecommendationInsightsDto();

        dto.topRecommendedChannels = engagementRepo.topChannelsByViewsSince(since, PageRequest.of(0, 10)).stream()
                .map(row -> {
                    Long id = (Long) row[0];
                    TelegramChannel ch = channelRepo.findById(id).orElse(null);
                    String label = ch != null
                            ? (ch.getDisplayName() != null ? ch.getDisplayName() : ch.getChannelUsername())
                            : "Channel " + id;
                    return new LabelCountDto(label, ((Number) row[1]).longValue());
                })
                .collect(Collectors.toList());

        Map<String, Double> tagWeights = new HashMap<>();
        Map<String, Double> topicWeights = new HashMap<>();
        for (ChannelPreferenceProfile p : profileRepo.findAll()) {
            Map<String, Double> vec = TagVectorUtils.parseVector(p.getFinalTagVector());
            for (var e : vec.entrySet()) {
                tagWeights.merge(e.getKey(), e.getValue(), Double::sum);
                if (e.getKey().contains(":")) {
                    topicWeights.merge(e.getKey().split(":")[0], e.getValue(), Double::sum);
                }
            }
        }

        if (tagWeights.isEmpty()) {
            for (Object[] row : engagementRepo.topChannelsByViewsSince(since, PageRequest.of(0, 20))) {
                Long channelId = (Long) row[0];
                double views = ((Number) row[1]).doubleValue();
                profileRepo.findByChannel_Id(channelId).ifPresent(p -> {
                    Map<String, Double> vec = TagVectorUtils.parseVector(p.getFinalTagVector());
                    if (vec.isEmpty()) {
                        vec = TagVectorUtils.parseVector(p.getPostTagVector());
                    }
                    for (var e : vec.entrySet()) {
                        tagWeights.merge(e.getKey(), e.getValue() * views, Double::sum);
                    }
                });
            }
        }

        if (tagWeights.isEmpty()) {
            for (Object[] row : postTagRepo.findPopularTags(PageRequest.of(0, 15))) {
                if (row[0] != null) {
                    tagWeights.put(String.valueOf(row[0]), ((Number) row[1]).doubleValue());
                }
            }
        }

        dto.topRecommendedTags = tagWeights.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .limit(12)
                .map(e -> new LabelCountDto(e.getKey(), Math.round(e.getValue() * 10) / 10.0))
                .collect(Collectors.toList());

        dto.topRecommendedTopics = topicWeights.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .limit(8)
                .map(e -> new LabelCountDto(e.getKey(), Math.round(e.getValue() * 10) / 10.0))
                .collect(Collectors.toList());

        dto.similarityGraph = buildSimilarityGraph();
        return dto;
    }

    private TelegramSimilarityGraphDto buildSimilarityGraph() {
        List<ChannelPreferenceProfile> profiles = profileRepo.findAllWithChannelAndTagVector().stream()
                .limit(40)
                .toList();

        TelegramSimilarityGraphDto graph = new TelegramSimilarityGraphDto();
        graph.nodes = profiles.stream().map(p -> {
            TelegramChannel ch = p.getChannel();
            TelegramSimilarityGraphDto.GraphNodeDto n = new TelegramSimilarityGraphDto.GraphNodeDto();
            n.id = ch.getId();
            n.label = ch.getDisplayName() != null ? ch.getDisplayName() : ch.getChannelUsername();
            n.username = ch.getChannelUsername();
            return n;
        }).collect(Collectors.toList());

        graph.edges = new ArrayList<>();
        for (int i = 0; i < profiles.size(); i++) {
            Map<String, Double> vi = TagVectorUtils.parseVector(profiles.get(i).getFinalTagVector());
            for (int j = i + 1; j < profiles.size(); j++) {
                Map<String, Double> vj = TagVectorUtils.parseVector(profiles.get(j).getFinalTagVector());
                double sim = TagVectorUtils.similarity(vi, vj);
                if (sim >= SIMILARITY_THRESHOLD) {
                    TelegramSimilarityGraphDto.GraphEdgeDto edge = new TelegramSimilarityGraphDto.GraphEdgeDto();
                    edge.source = profiles.get(i).getChannel().getId();
                    edge.target = profiles.get(j).getChannel().getId();
                    edge.similarity = Math.round(sim * 100.0) / 100.0;
                    graph.edges.add(edge);
                }
            }
        }
        return graph;
    }
}
