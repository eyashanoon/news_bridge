package com.example.newscrawler.service;

import com.example.newscrawler.dto.*;
import com.example.newscrawler.entity.CategoryField;
import com.example.newscrawler.entity.Topic;
import com.example.newscrawler.entity.TopicPost;
import com.example.newscrawler.repository.CategoryFieldRepository;
import com.example.newscrawler.repository.TopicRepository;
import com.example.newscrawler.repository.TopicPostRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class TopicService {

    private final TopicRepository topicRepository;
    private final TopicPostRepository topicPostRepository;
    private final CategoryFieldRepository categoryFieldRepository;
    private final TopicEditorService topicEditorService;

    public TopicService(TopicRepository topicRepository,
                        TopicPostRepository topicPostRepository,
                        CategoryFieldRepository categoryFieldRepository,
                        TopicEditorService topicEditorService) {
        this.topicRepository = topicRepository;
        this.topicPostRepository = topicPostRepository;
        this.categoryFieldRepository = categoryFieldRepository;
        this.topicEditorService = topicEditorService;
    }

    // ─── Topics ───────────────────────────────────────────────────────────────

    /**
     * Get active (publicly visible) topics for the Trending Topics page.
     */
    public List<TopicResponse> getAllActiveTopics() {
        return topicRepository.findByStatusOrderByGrowthDesc("ACTIVE")
                .stream()
                .map(this::toTopicResponse)
                .collect(Collectors.toList());
    }

    /**
     * Get all topics (admin view including drafts).
     */
    public List<TopicResponse> getAllTopics() {
        return topicRepository.findAll()
                .stream()
                .map(this::toTopicResponse)
                .collect(Collectors.toList());
    }

    /**
     * Get topics visible to an editor — ACTIVE (published) topics
     * plus DRAFT topics matching their field.
     */
    public List<TopicResponse> getTopicsForEditor(String editorEmail, List<Long> editorFieldIds) {
        return topicRepository.findAll().stream()
            .filter(t -> "ACTIVE".equals(t.getStatus()) ||
                         ("DRAFT".equals(t.getStatus()) &&
                          t.getFields() != null &&
                          t.getFields().stream().anyMatch(f -> editorFieldIds.contains(f.getId()))))
            .map(this::toTopicResponse)
            .collect(Collectors.toList());
    }

    public TopicResponse getTopicById(Long id) {
        Topic topic = topicRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Topic not found: " + id));
        return toTopicResponse(topic);
    }

    /**
     * Admin creates a topic.
     */
    @Transactional
    public TopicResponse createTopic(CreateTopicRequest request, String adminEmail) {
        if (request.title == null || request.title.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Topic title is required");
        }

        Topic topic = new Topic();
        topic.setTitle(request.title);
        topic.setDescription(request.description);
        topic.setImageUrl(request.imageUrl);
        topic.setAuthor(request.author != null ? request.author : "News Bridge");
        topic.setTags(request.tags != null ? String.join(",", request.tags) : "");
        topic.setGrowth(request.status != null && "ACTIVE".equals(request.status) ? 50 : 0);
        topic.setPostCount(0);
        topic.setContributorCount(0);
        topic.setStatus(request.status != null ? request.status : "DRAFT");
        topic.setCreatedByEmail(adminEmail);

        // Set fields
        if (request.fieldIds != null && !request.fieldIds.isEmpty()) {
            List<CategoryField> fields = request.fieldIds.stream()
                .map(fid -> categoryFieldRepository.findById(fid)
                    .orElseThrow(() -> new RuntimeException("Field not found: " + fid)))
                .collect(Collectors.toList());
            topic.setFields(fields);
        }

        topic = topicRepository.save(topic);
        return toTopicResponse(topic);
    }

    /**
     * Admin updates a topic.
     */
    @Transactional
    public TopicResponse updateTopic(Long id, CreateTopicRequest request) {
        Topic topic = topicRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Topic not found"));

        if (request.title != null && !request.title.isBlank()) topic.setTitle(request.title);
        if (request.description != null) topic.setDescription(request.description);
        if (request.imageUrl != null) topic.setImageUrl(request.imageUrl);
        if (request.author != null) topic.setAuthor(request.author);
        if (request.tags != null) topic.setTags(String.join(",", request.tags));
        if (request.status != null) topic.setStatus(request.status);

        if (request.fieldIds != null) {
            List<CategoryField> fields = request.fieldIds.stream()
                .map(fid -> categoryFieldRepository.findById(fid)
                    .orElseThrow(() -> new RuntimeException("Field not found: " + fid)))
                .collect(Collectors.toList());
            topic.setFields(fields);
        }

        return toTopicResponse(topicRepository.save(topic));
    }

    /**
     * Admin changes topic status (e.g., DRAFT → ACTIVE, ACTIVE → INACTIVE).
     */
    @Transactional
    public TopicResponse changeTopicStatus(Long id, String status) {
        Topic topic = topicRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Topic not found"));
        topic.setStatus(status);
        return toTopicResponse(topicRepository.save(topic));
    }

    @Transactional
    public void deleteTopic(Long id) {
        topicPostRepository.findByTopicIdOrderByCreatedAtDesc(id)
                .forEach(tp -> topicPostRepository.delete(tp));
        topicRepository.deleteById(id);
    }

    // ─── Topic Posts ──────────────────────────────────────────────────────────

    public List<TopicPostResponse> getPostsByTopic(Long topicId) {
        return topicPostRepository.findByTopicIdOrderByCreatedAtDesc(topicId)
                .stream()
                .map(this::toTopicPostResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public TopicPostResponse createPost(Long topicId, CreateTopicPostRequest request, String authorEmail, String authorName, Long editorId) {
        Topic topic = topicRepository.findById(topicId)
                .orElseThrow(() -> new RuntimeException("Topic not found: " + topicId));

        if (!"ACTIVE".equals(topic.getStatus())) {
            throw new RuntimeException("Cannot post to a topic that is not active");
        }

        // Check if editor can post (field match + assignment)
        if (editorId != null && !topicEditorService.canEditorPost(topicId, editorId)) {
            throw new RuntimeException("You are not authorized to post to this topic. Make sure your fields match and you have been approved.");
        }

        TopicPost post = new TopicPost();
        post.setTopic(topic);
        post.setText(request.text);
        post.setLabel(request.label);
        post.setLang(request.lang != null ? request.lang : "en");
        post.setTags(request.tags != null ? String.join(",", request.tags) : "");
        post.setLikes(0);
        post.setDislikes(0);
        post.setAuthor(authorName);
        post.setAuthorEmail(authorEmail);
        post = topicPostRepository.save(post);

        // Update topic stats
        topic.setPostCount(topicPostRepository.countByTopicId(topicId));
        topic.setContributorCount((int) topicPostRepository.findByTopicIdOrderByCreatedAtDesc(topicId)
                .stream().map(TopicPost::getAuthorEmail).distinct().count());
        topicRepository.save(topic);

        return toTopicPostResponse(post);
    }

    // ─── Mappers ──────────────────────────────────────────────────────────────

    private TopicResponse toTopicResponse(Topic topic) {
        TopicResponse r = new TopicResponse();
        r.id = topic.getId();
        r.title = topic.getTitle();
        r.description = topic.getDescription();
        r.imageUrl = topic.getImageUrl();
        r.author = topic.getAuthor();
        r.tags = topic.getTags() != null && !topic.getTags().isEmpty()
                ? Arrays.asList(topic.getTags().split(","))
                : Collections.emptyList();
        r.growth = topic.getGrowth();
        r.posts = topic.getPostCount();
        r.contributors = topic.getContributorCount();
        r.status = topic.getStatus();
        r.createdByEmail = topic.getCreatedByEmail();
        r.createdAt = topic.getCreatedAt();

        // Map fields
        if (topic.getFields() != null && !topic.getFields().isEmpty()) {
            r.fieldIds = topic.getFields().stream()
                .map(CategoryField::getId)
                .collect(Collectors.toList());
            r.fieldNames = topic.getFields().stream()
                .map(CategoryField::getName)
                .collect(Collectors.toList());
        } else {
            r.fieldIds = Collections.emptyList();
            r.fieldNames = Collections.emptyList();
        }

        return r;
    }

    private TopicPostResponse toTopicPostResponse(TopicPost post) {
        TopicPostResponse r = new TopicPostResponse();
        r.id = post.getId();
        r.topicId = post.getTopic().getId();
        r.text = post.getText();
        r.label = post.getLabel();
        r.lang = post.getLang();
        r.tags = post.getTags() != null && !post.getTags().isEmpty()
                ? Arrays.asList(post.getTags().split(","))
                : Collections.emptyList();
        r.likes = post.getLikes();
        r.dislikes = post.getDislikes();
        r.author = post.getAuthor();
        r.createdAt = post.getCreatedAt();
        return r;
    }
}