package com.example.newscrawler.service;

import com.example.newscrawler.dto.*;
import com.example.newscrawler.entity.AppUser;
import com.example.newscrawler.entity.CategoryField;
import com.example.newscrawler.entity.EditorUser;
import com.example.newscrawler.entity.ReactionType;
import com.example.newscrawler.entity.Topic;
import com.example.newscrawler.entity.TopicPost;
import com.example.newscrawler.entity.TopicPostReaction;
import com.example.newscrawler.repository.CategoryFieldRepository;
import com.example.newscrawler.repository.EditorUserRepository;
import com.example.newscrawler.repository.TopicRepository;
import com.example.newscrawler.repository.TopicPostRepository;
import com.example.newscrawler.repository.TopicPostReactionRepository;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class TopicService {

    private final TopicRepository topicRepository;
    private final TopicPostRepository topicPostRepository;
    private final TopicPostReactionRepository topicPostReactionRepository;
    private final CategoryFieldRepository categoryFieldRepository;
    private final TopicEditorService topicEditorService;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private EditorUserRepository editorUserRepository;

    public TopicService(TopicRepository topicRepository,
                        TopicPostRepository topicPostRepository,
                        TopicPostReactionRepository topicPostReactionRepository,
                        CategoryFieldRepository categoryFieldRepository,
                        TopicEditorService topicEditorService) {
        this.topicRepository = topicRepository;
        this.topicPostRepository = topicPostRepository;
        this.topicPostReactionRepository = topicPostReactionRepository;
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
     * Get the raw Topic entity by ID (for internal use, not for API responses).
     */
    public Topic getTopicEntityById(Long id) {
        return topicRepository.findById(id).orElse(null);
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
        // 1) Delete all child rows that reference this topic
        clearTopicChildren(id);
        // 2) Delete the topic itself
        topicRepository.deleteById(id);
    }

    /**
     * Delete every topic (and all their child rows: posts, editor assignments,
     * etc.). Used by the admin cleanup endpoint to clear out orphaned/duplicated
     * topics that were left behind by the old title-match logic. The admin's
     * events will auto-recreate the canonical topics the next time the
     * backend processes them.
     *
     * @return number of topics that were deleted
     */
    @Transactional
    public int deleteAllTopics() {
        List<Topic> all = topicRepository.findAll();
        int count = all.size();
        // 1) Wipe ALL editor assignments in one shot — they're the main blocker
        //    for cascading topic deletes (FK on topic_editor_assignments.topic_id).
        try {
            entityManager.createNativeQuery("DELETE FROM topic_editor_assignments").executeUpdate();
        } catch (Exception e) {
            System.err.println("Failed to clear topic_editor_assignments: " + e.getMessage());
        }
        // 2) For each topic, delete its posts (the @ManyToOne between topic_posts
        //    and topics is normally safe, but be explicit).
        for (Topic t : all) {
            topicPostRepository.findByTopicIdOrderByCreatedAtDesc(t.getId())
                    .forEach(tp -> topicPostRepository.delete(tp));
        }
        // 3) Bulk-delete the topics themselves.
        topicRepository.deleteAll(all);
        return count;
    }

    /**
     * Clean up all child rows that reference a topic (posts, editor assignments,
     * etc.) so the topic can be deleted without violating any FK constraints.
     */
    @Transactional
    protected void clearTopicChildren(Long topicId) {
        // Editor assignments
        try {
            entityManager.createNativeQuery(
                "DELETE FROM topic_editor_assignments WHERE topic_id = :tid")
                .setParameter("tid", topicId)
                .executeUpdate();
        } catch (Exception e) {
            System.err.println("Failed to clear topic_editor_assignments for topic " + topicId + ": " + e.getMessage());
        }
        // Posts (also done via repository for entity-manager flush ordering)
        topicPostRepository.findByTopicIdOrderByCreatedAtDesc(topicId)
                .forEach(tp -> topicPostRepository.delete(tp));
    }

    /**
     * Admin deletes a single post from a topic.
     */
    @Transactional
    public void deleteTopicPost(Long topicId, Long postId) {
        TopicPost post = topicPostRepository.findById(postId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Post not found"));

        if (!post.getTopic().getId().equals(topicId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Post does not belong to this topic");
        }

        // Log the deletion warning
        System.out.println("ADMIN DELETED POST #" + postId + " by '" + post.getAuthor() 
            + "' from topic '" + post.getTopic().getTitle() + "'");

        topicPostReactionRepository.deleteByTopicPost_Id(postId);
        topicPostRepository.delete(post);

        // Update topic stats
        Topic topic = post.getTopic();
        topic.setPostCount(topicPostRepository.countByTopicId(topicId));
        topic.setContributorCount((int) topicPostRepository.findByTopicIdOrderByCreatedAtDesc(topicId)
                .stream().map(TopicPost::getAuthorEmail).distinct().count());
        topicRepository.save(topic);
    }

    // ─── Topic Posts ──────────────────────────────────────────────────────────

    public List<TopicPostResponse> getPostsByTopic(Long topicId, AppUser appUser) {
        List<TopicPost> posts = topicPostRepository.findByTopicIdOrderByCreatedAtDesc(topicId);
        Map<Long, ReactionType> userReactionMap = new HashMap<>();

        if (appUser != null && !posts.isEmpty()) {
            List<Long> postIds = posts.stream().map(TopicPost::getId).toList();
            for (TopicPostReaction reaction : topicPostReactionRepository
                    .findByAppUserIdAndTopicPostIdIn(appUser.getId(), postIds)) {
                userReactionMap.put(reaction.getTopicPost().getId(), reaction.getReactionType());
            }
        }

        return posts.stream()
                .map(post -> toTopicPostResponse(post, userReactionMap.get(post.getId())))
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
        post.setTitle(request.title);
        post.setText(request.text);
        post.setLabel(request.label);
        post.setLang(request.lang != null ? request.lang : "en");
        post.setTags(request.tags != null ? String.join(",", request.tags) : "");
        post.setLikes(0);
        post.setDislikes(0);
        post.setAuthor(authorName);
        post.setAuthorEmail(authorEmail);
        // Look up editor profile picture from DB
        if (editorId != null) {
            try {
                EditorUser editorUser = entityManager.find(EditorUser.class, editorId);
                if (editorUser != null && editorUser.getProfilePicture() != null && !editorUser.getProfilePicture().isBlank()) {
                    post.setAuthorProfilePicture(editorUser.getProfilePicture());
                }
            } catch (Exception e) {
                // ignore
            }
        }
        post.setMediaUrl(request.mediaUrl);
        post.setMediaType(request.mediaType);
        post = topicPostRepository.save(post);

        // Update topic stats
        topic.setPostCount(topicPostRepository.countByTopicId(topicId));
        topic.setContributorCount((int) topicPostRepository.findByTopicIdOrderByCreatedAtDesc(topicId)
                .stream().map(TopicPost::getAuthorEmail).distinct().count());
        topicRepository.save(topic);

        return toTopicPostResponse(post, null);
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

        // Map trending statistics
        r.totalLikes = topic.getTotalLikes();
        r.totalDislikes = topic.getTotalDislikes();
        r.totalComments = topic.getTotalComments();
        r.activityScore = topic.getActivityScore();
        r.lastActivityAt = topic.getLastActivityAt() != null ? topic.getLastActivityAt().toString() : null;
        r.statsUpdatedAt = topic.getStatsUpdatedAt() != null ? topic.getStatsUpdatedAt().toString() : null;

        return r;
    }

    private TopicPostResponse toTopicPostResponse(TopicPost post, ReactionType userReaction) {
        TopicPostResponse r = new TopicPostResponse();
        r.id = post.getId();
        r.topicId = post.getTopic().getId();
        r.title = post.getTitle();
        r.text = post.getText();
        r.label = post.getLabel();
        r.lang = post.getLang();
        r.tags = post.getTags() != null && !post.getTags().isEmpty()
                ? Arrays.asList(post.getTags().split(","))
                : Collections.emptyList();
        r.likes = post.getLikes();
        r.dislikes = post.getDislikes();
        r.userReaction = userReaction;
        r.author = post.getAuthor();
        r.authorEmail = post.getAuthorEmail();
        // Try to find editor from email — use CURRENT profile data (not stale snapshot)
        if (post.getAuthorEmail() != null) {
            try {
                EditorUser editorUser = editorUserRepository.findByEmail(post.getAuthorEmail()).orElse(null);
                if (editorUser != null) {
                    r.authorId = editorUser.getId();
                    // Always prefer the editor's current profile picture over the stored snapshot
                    if (editorUser.getProfilePicture() != null && !editorUser.getProfilePicture().isBlank()) {
                        r.authorProfilePicture = editorUser.getProfilePicture();
                    }
                    // Always prefer the editor's current display name over the stored snapshot
                    String displayName = editorUser.getUsername() != null ? editorUser.getUsername() : editorUser.getFullName();
                    if (displayName != null && !displayName.isBlank()) {
                        r.author = displayName;
                    }
                } else {
                    // Fallback to stored snapshot if editor no longer exists
                    r.authorProfilePicture = post.getAuthorProfilePicture();
                }
            } catch (Exception e) {
                r.authorId = null;
                r.authorProfilePicture = post.getAuthorProfilePicture();
            }
        } else {
            r.authorProfilePicture = post.getAuthorProfilePicture();
        }
        r.mediaUrl = post.getMediaUrl();
        r.mediaType = post.getMediaType();
        // Build mediaItems from the stored JSON in mediaUrl or as a single item
        r.mediaItems = buildMediaItems(post.getMediaUrl(), post.getMediaType());
        r.createdAt = post.getCreatedAt();
        return r;
    }

    /**
     * Build a list of media items from the stored mediaUrl/mediaType.
     * Supports both single media and JSON-encoded multi-media.
     */
    private List<Map<String, String>> buildMediaItems(String mediaUrl, String mediaType) {
        List<Map<String, String>> items = new java.util.ArrayList<>();
        if (mediaUrl == null || mediaUrl.isBlank()) return items;

        // Try to parse as JSON array of {type, url} objects
        try {
            if (mediaUrl.trim().startsWith("[")) {
                ObjectMapper mapper = new ObjectMapper();
                List<Map<String, String>> parsed = mapper.readValue(mediaUrl, List.class);
                if (parsed != null && !parsed.isEmpty()) {
                    for (Object obj : parsed) {
                        if (obj instanceof Map) {
                            Map<String, String> item = new java.util.HashMap<>();
                            @SuppressWarnings("unchecked")
                            Map<String, Object> raw = (Map<String, Object>) obj;
                            item.put("type", raw.getOrDefault("type", "image").toString());
                            item.put("url", raw.getOrDefault("url", "").toString());
                            items.add(item);
                        }
                    }
                    if (!items.isEmpty()) return items;
                }
            }
        } catch (Exception e) {
            // Not JSON, fall through to single item
        }

        // Single media item fallback
        Map<String, String> single = new java.util.HashMap<>();
        single.put("type", mediaType != null ? mediaType : "image");
        single.put("url", mediaUrl);
        items.add(single);
        return items;
    }
}