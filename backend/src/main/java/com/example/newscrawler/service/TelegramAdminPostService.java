package com.example.newscrawler.service;

import com.example.newscrawler.dto.RecommendationImpactDto;
import com.example.newscrawler.dto.TelegramPostAdminDto;
import com.example.newscrawler.dto.TelegramPostDetailDto;
import com.example.newscrawler.entity.TelegramPost;
import com.example.newscrawler.entity.TelegramPostTag;
import com.example.newscrawler.repository.TelegramEngagementEventRepository;
import com.example.newscrawler.repository.TelegramPostRepository;
import com.example.newscrawler.repository.TelegramPostTagRepository;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class TelegramAdminPostService {

    private final TelegramPostRepository postRepo;
    private final TelegramPostTagRepository tagRepo;
    private final TelegramEngagementEventRepository engagementRepo;
    private final TelegramPostTaggingService taggingService;

    public TelegramAdminPostService(TelegramPostRepository postRepo,
                                      TelegramPostTagRepository tagRepo,
                                      TelegramEngagementEventRepository engagementRepo,
                                      TelegramPostTaggingService taggingService) {
        this.postRepo = postRepo;
        this.tagRepo = tagRepo;
        this.engagementRepo = engagementRepo;
        this.taggingService = taggingService;
    }

    public Page<TelegramPostAdminDto> search(String q, Long channelId, String tag, String mediaType,
                                             Instant dateFrom, Instant dateTo, String sort, int page, int size) {
        Page<TelegramPost> raw = postRepo.searchAdmin(
                blankToNull(q), channelId, blankToNull(mediaType), dateFrom, dateTo,
                PageRequest.of(page, size, buildSort(sort)));

        List<TelegramPost> posts = new ArrayList<>(raw.getContent());
        if (tag != null && !tag.isBlank()) {
            Set<Long> postIds = new HashSet<>(tagRepo.findPostIdsByTagLike(tag.trim()));
            posts = posts.stream().filter(p -> postIds.contains(p.getId())).toList();
        }

        Map<Long, List<String>> tagsByPost = loadTags(posts.stream().map(TelegramPost::getId).toList());
        List<TelegramPostAdminDto> dtos = posts.stream()
                .map(p -> toAdminDto(p, tagsByPost.getOrDefault(p.getId(), List.of())))
                .collect(Collectors.toList());

        if (tag != null && !tag.isBlank()) {
            return new PageImpl<>(dtos, PageRequest.of(page, size), dtos.size());
        }
        return new PageImpl<>(dtos, raw.getPageable(), raw.getTotalElements());
    }

    public TelegramPostDetailDto getDetail(Long postId) {
        TelegramPost post = postRepo.findById(postId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found"));
        List<String> tags = tagRepo.findByTelegramPost_Id(postId).stream()
                .map(TelegramPostTag::getTag)
                .collect(Collectors.toList());

        TelegramPostDetailDto dto = new TelegramPostDetailDto();
        dto.id = post.getId();
        dto.channelId = post.getChannel().getId();
        dto.channelUsername = post.getChannel().getChannelUsername();
        dto.channelDisplayName = post.getChannel().getDisplayName();
        dto.content = post.getContent();
        dto.mediaUrl = post.getMediaUrl();
        dto.mediaType = post.getMediaType();
        dto.messageDate = post.getMessageDate();
        dto.viewCount = post.getViewCount();
        dto.edited = post.isEdited();
        dto.tags = tags;
        dto.recommendationImpact = buildImpact(postId);
        return dto;
    }

    public void retag(Long postId) {
        TelegramPost post = postRepo.findById(postId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found"));
        taggingService.extractAndSaveTags(post);
    }

    private RecommendationImpactDto buildImpact(Long postId) {
        RecommendationImpactDto impact = new RecommendationImpactDto();
        impact.interactionCount = engagementRepo.countByPostId(postId);
        impact.likes = 0;
        impact.dislikes = 0;
        impact.reports = 0;
        Double readTime = engagementRepo.avgReadTimeByPostId(postId);
        impact.averageReadTimeSeconds = readTime != null ? readTime : 0.0;
        return impact;
    }

    private TelegramPostAdminDto toAdminDto(TelegramPost p, List<String> tags) {
        TelegramPostAdminDto dto = new TelegramPostAdminDto();
        dto.id = p.getId();
        dto.channelId = p.getChannel().getId();
        dto.channelUsername = p.getChannel().getChannelUsername();
        dto.channelDisplayName = p.getChannel().getDisplayName();
        String content = p.getContent() != null ? p.getContent() : "";
        dto.contentPreview = content.length() > 160 ? content.substring(0, 160) + "…" : content;
        dto.mediaUrl = p.getMediaUrl();
        dto.mediaType = p.getMediaType();
        dto.messageDate = p.getMessageDate();
        dto.viewCount = p.getViewCount();
        dto.edited = p.isEdited();
        dto.tagsExtracted = p.isTagsExtracted();
        dto.tags = tags;
        dto.engagementScore = p.getViewCount() + engagementRepo.countByPostId(p.getId()) * 2.0;
        dto.collectedAt = p.getCollectedAt();
        return dto;
    }

    private Map<Long, List<String>> loadTags(List<Long> postIds) {
        if (postIds.isEmpty()) return Map.of();
        return tagRepo.findWithPostByPostIdIn(postIds).stream()
                .collect(Collectors.groupingBy(
                        t -> t.getTelegramPost().getId(),
                        Collectors.mapping(TelegramPostTag::getTag, Collectors.toList())));
    }

    private Sort buildSort(String sort) {
        if ("most_viewed".equalsIgnoreCase(sort)) {
            return Sort.by(Sort.Direction.DESC, "viewCount");
        }
        if ("engagement".equalsIgnoreCase(sort)) {
            return Sort.by(Sort.Direction.DESC, "viewCount");
        }
        return Sort.by(Sort.Direction.DESC, "messageDate");
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }
}
