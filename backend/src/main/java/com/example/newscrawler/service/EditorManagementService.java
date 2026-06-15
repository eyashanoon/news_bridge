package com.example.newscrawler.service;

import com.example.newscrawler.dto.AssignEditorCategoriesRequest;
import com.example.newscrawler.dto.DailyActivityDto;
import com.example.newscrawler.dto.EditorActivityEntryDto;
import com.example.newscrawler.dto.EditorContentItemDto;
import com.example.newscrawler.dto.EditorProfileAnalyticsResponse;
import com.example.newscrawler.dto.EditorStatsResponse;
import com.example.newscrawler.dto.EditorUserResponse;
import com.example.newscrawler.dto.PagedResponse;
import com.example.newscrawler.dto.TagWeightSummaryDto;
import com.example.newscrawler.entity.AdminActivityLog;
import com.example.newscrawler.entity.CategoryField;
import com.example.newscrawler.entity.EditorRequest;
import com.example.newscrawler.entity.EditorUser;
import com.example.newscrawler.entity.LiveNewsPost;
import com.example.newscrawler.entity.LoginDevice;
import com.example.newscrawler.entity.TopicPost;
import com.example.newscrawler.entity.UserRole;
import com.example.newscrawler.entity.UserStatus;
import com.example.newscrawler.repository.AdminActivityLogRepository;
import com.example.newscrawler.repository.CategoryFieldRepository;
import com.example.newscrawler.repository.EditorRequestRepository;
import com.example.newscrawler.repository.EditorUserRepository;
import com.example.newscrawler.repository.LiveNewsPostRepository;
import com.example.newscrawler.repository.LoginDeviceRepository;
import com.example.newscrawler.repository.TopicPostRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Transactional
public class EditorManagementService {

    @Autowired
    private EditorUserRepository editorUserRepository;

    @Autowired
    private UserManagementService userManagementService;

    @Autowired
    private UserActivityMetricsService activityMetricsService;

    @Autowired
    private EditorRequestRepository editorRequestRepository;

    @Autowired
    private LiveNewsPostRepository liveNewsPostRepository;

    @Autowired
    private TopicPostRepository topicPostRepository;

    @Autowired
    private CategoryFieldRepository categoryFieldRepository;

    @Autowired
    private LoginDeviceRepository loginDeviceRepository;

    @Autowired
    private AdminActivityLogRepository adminActivityLogRepository;

    public EditorUserResponse getEditorById(Long id) {
        EditorUser editor = editorUserRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Editor not found"));
        EditorUserResponse response = userManagementService.mapEditorWithContributions(
                editor, activityMetricsService.getMetrics(editor.getId()));
        enrichEditorDetail(editor, response);
        return response;
    }

    public EditorStatsResponse getEditorStats() {
        List<EditorUser> editors = editorUserRepository.findAll();
        Map<Long, long[]> contributions = loadContributions();

        long totalContent = contributions.values().stream().mapToLong(c -> c[0]).sum();
        long activeCount = editors.stream().filter(e -> e.getStatus() == UserStatus.ACTIVE).count();

        EditorStatsResponse stats = new EditorStatsResponse();
        stats.totalEditors = editors.size();
        stats.activeEditors = activeCount;
        stats.pendingEditors = editors.stream().filter(e -> e.getStatus() == UserStatus.PENDING_ACTIVATION).count();
        stats.suspendedEditors = editors.stream().filter(e -> e.getStatus() == UserStatus.SUSPENDED).count();
        stats.totalPublishedContent = totalContent;
        stats.averageContentPerEditor = editors.isEmpty() ? 0 : (double) totalContent / editors.size();

        var metrics = activityMetricsService.getAllMetrics();
        editors.stream()
                .filter(e -> metrics.containsKey(e.getId()) && metrics.get(e.getId()).lastActivityAt != null)
                .max(Comparator.comparing(e -> metrics.get(e.getId()).lastActivityAt))
                .ifPresent(e -> {
                    stats.lastActiveEditorName = e.getFullName() != null ? e.getFullName() : e.getUsername();
                    stats.lastActiveEditorEmail = e.getEmail();
                    stats.lastActiveEditorAt = metrics.get(e.getId()).lastActivityAt;
                });

        return stats;
    }

    public PagedResponse<EditorContentItemDto> getEditorContent(
            Long id, String search, String type, int page, int size) {

        EditorUser editor = editorUserRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Editor not found"));

        List<EditorContentItemDto> items = new ArrayList<>();
        String q = search != null ? search.trim().toLowerCase() : "";

        if (type == null || type.isBlank() || "LIVE_POST".equalsIgnoreCase(type)) {
            for (LiveNewsPost post : liveNewsPostRepository.findByAuthorOrderByPublishedAtDesc(editor)) {
                if (!q.isEmpty() && !post.getHeadline().toLowerCase().contains(q)) continue;
                EditorContentItemDto dto = new EditorContentItemDto();
                dto.id = post.getId();
                dto.type = "LIVE_POST";
                dto.title = post.getHeadline();
                dto.status = "PUBLISHED";
                dto.createdAt = post.getPublishedAt();
                dto.engagement = 0L;
                dto.contextLabel = post.getEvent() != null ? post.getEvent().getTitle() : null;
                items.add(dto);
            }
        }

        if (type == null || type.isBlank() || "TOPIC_POST".equalsIgnoreCase(type)) {
            for (TopicPost post : topicPostRepository.findByAuthorEmailOrderByCreatedAtDesc(editor.getEmail())) {
                String title = post.getTitle() != null ? post.getTitle() : post.getText();
                if (!q.isEmpty() && title != null && !title.toLowerCase().contains(q)) continue;
                EditorContentItemDto dto = new EditorContentItemDto();
                dto.id = post.getId();
                dto.type = "TOPIC_POST";
                dto.title = title != null && title.length() > 120 ? title.substring(0, 120) + "…" : title;
                dto.status = "PUBLISHED";
                dto.createdAt = post.getCreatedAt() != null
                        ? post.getCreatedAt().atZone(ZoneOffset.UTC).toInstant() : null;
                dto.engagement = (long) post.getLikes() + post.getDislikes();
                dto.contextLabel = post.getTopic() != null ? post.getTopic().getTitle() : null;
                items.add(dto);
            }
        }

        items.sort(Comparator.comparing(
                (EditorContentItemDto i) -> i.createdAt != null ? i.createdAt : Instant.EPOCH).reversed());

        int safeSize = Math.max(1, Math.min(size, 100));
        int safePage = Math.max(0, page);
        int total = items.size();
        int totalPages = Math.max(1, (int) Math.ceil((double) total / safeSize));
        int from = Math.min(safePage * safeSize, total);
        int to = Math.min(from + safeSize, total);
        return new PagedResponse<>(items.subList(from, to), total, safePage, safeSize, totalPages);
    }

    public EditorProfileAnalyticsResponse getEditorProfileAnalytics(Long id, int periodDays) {
        EditorUser editor = editorUserRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Editor not found"));

        int days = Math.max(1, Math.min(periodDays, 90));
        Instant since = Instant.now().minusSeconds((long) days * 24 * 3600);

        List<LiveNewsPost> livePosts = liveNewsPostRepository.findByAuthorOrderByPublishedAtDesc(editor).stream()
                .filter(p -> p.getPublishedAt() != null && !p.getPublishedAt().isBefore(since))
                .collect(Collectors.toList());

        List<TopicPost> topicPosts = topicPostRepository.findByAuthorEmailOrderByCreatedAtDesc(editor.getEmail()).stream()
                .filter(p -> p.getCreatedAt() != null
                        && !p.getCreatedAt().isBefore(since.atZone(ZoneOffset.UTC).toLocalDateTime()))
                .collect(Collectors.toList());

        EditorProfileAnalyticsResponse response = new EditorProfileAnalyticsResponse();
        response.periodDays = days;
        response.livePostCount = livePosts.size();
        response.topicPostCount = topicPosts.size();
        response.totalContent = response.livePostCount + response.topicPostCount;
        response.totalEngagement = topicPosts.stream()
                .mapToLong(p -> p.getLikes() + p.getDislikes()).sum();

        long approved = editorRequestRepository.countByStatus("APPROVED");
        long rejected = editorRequestRepository.countByStatus("REJECTED");
        long total = approved + rejected;
        response.approvalRate = total > 0 ? (double) approved / total : 1.0;

        response.contentOverTime = buildContentOverTime(since, livePosts, topicPosts);
        response.topPerformingContent = buildTopContent(editor, livePosts, topicPosts);
        response.categoryDistribution = buildCategoryDistribution(editor);

        return response;
    }

    public List<EditorActivityEntryDto> getEditorActivity(Long id) {
        EditorUser editor = editorUserRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Editor not found"));

        List<EditorActivityEntryDto> entries = new ArrayList<>();

        for (LoginDevice device : loginDeviceRepository.findByUserId(editor.getId())) {
            EditorActivityEntryDto dto = new EditorActivityEntryDto();
            dto.type = "LOGIN";
            dto.label = device.getDeviceLabel();
            dto.timestamp = device.getLastSeenAt();
            dto.detail = "Last seen on " + device.getDeviceLabel();
            entries.add(dto);
        }

        String targetPrefix = "editor-user:" + id;
        for (AdminActivityLog log : adminActivityLogRepository.findByTargetResourceContainingOrderByTimestampDesc(targetPrefix)) {
            EditorActivityEntryDto dto = new EditorActivityEntryDto();
            dto.type = "ADMIN_ACTION";
            dto.label = log.getAction() != null ? log.getAction().name() : "ACTION";
            dto.timestamp = log.getTimestamp();
            dto.detail = log.getResult();
            entries.add(dto);
        }

        for (LiveNewsPost post : liveNewsPostRepository.findByAuthorOrderByPublishedAtDesc(editor).stream().limit(20).toList()) {
            EditorActivityEntryDto dto = new EditorActivityEntryDto();
            dto.type = "CONTENT";
            dto.label = "Live post published";
            dto.timestamp = post.getPublishedAt();
            dto.detail = post.getHeadline();
            entries.add(dto);
        }

        entries.sort(Comparator.comparing(
                (EditorActivityEntryDto e) -> e.timestamp != null ? e.timestamp : Instant.EPOCH).reversed());
        return entries.stream().limit(50).collect(Collectors.toList());
    }

    public EditorUserResponse assignCategories(Long id, AssignEditorCategoriesRequest request) {
        EditorUser editor = editorUserRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Editor not found"));

        List<CategoryField> fields = new ArrayList<>();
        if (request.fieldIds != null) {
            for (Long fieldId : request.fieldIds) {
                CategoryField field = categoryFieldRepository.findById(fieldId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid field id: " + fieldId));
                fields.add(field);
            }
        }
        editor.setFields(fields);
        EditorUser saved = editorUserRepository.save(editor);
        EditorUserResponse response = userManagementService.mapEditorWithContributions(
                saved, activityMetricsService.getMetrics(saved.getId()));
        enrichEditorDetail(saved, response);
        return response;
    }

    public EditorUserResponse promoteEditor(Long id) {
        EditorUser editor = editorUserRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Editor not found"));

        Set<UserRole> roles = editor.getRoles();
        roles.add(UserRole.EDIT_LIVE_NEWS);
        roles.add(UserRole.DELETE_LIVE_NEWS);
        editor.setRoles(roles);
        EditorUser saved = editorUserRepository.save(editor);
        EditorUserResponse response = userManagementService.mapEditorWithContributions(
                saved, activityMetricsService.getMetrics(saved.getId()));
        enrichEditorDetail(saved, response);
        return response;
    }

    private void enrichEditorDetail(EditorUser editor, EditorUserResponse response) {
        response.roleLevel = resolveRoleLevel(editor);
        response.assignedCategoryIds = editor.getFields() != null
                ? editor.getFields().stream().map(CategoryField::getId).collect(Collectors.toList())
                : List.of();

        editorRequestRepository.findFirstByUser_IdAndStatusOrderByUpdatedAtDesc(editor.getId(), "APPROVED")
                .ifPresent(req -> response.editorRequestId = req.getId());

        long liveCount = liveNewsPostRepository.countByAuthor_Id(editor.getId());
        long topicCount = topicPostRepository.findByAuthorEmailOrderByCreatedAtDesc(editor.getEmail()).size();
        response.livePostCount = liveCount;
        response.topicPostCount = topicCount;
    }

    private String resolveRoleLevel(EditorUser editor) {
        Set<UserRole> roles = editor.getRoles();
        if (roles.contains(UserRole.MANAGE_USERS) || roles.contains(UserRole.CREATE_ADMIN)) {
            return "Admin-assigned";
        }
        if (roles.contains(UserRole.DELETE_LIVE_NEWS) && roles.contains(UserRole.EDIT_LIVE_NEWS)) {
            return "Senior";
        }
        if (editor.getStatus() == UserStatus.ACTIVE
                && editorRequestRepository.findFirstByUser_IdAndStatusOrderByUpdatedAtDesc(editor.getId(), "APPROVED").isPresent()) {
            return "Verified";
        }
        return "Junior";
    }

    private Map<Long, long[]> loadContributions() {
        Map<Long, long[]> map = new HashMap<>();
        for (Object[] row : liveNewsPostRepository.aggregateByAuthor()) {
            Long editorId = (Long) row[0];
            long count = ((Number) row[1]).longValue();
            long[] entry = map.computeIfAbsent(editorId, k -> new long[2]);
            entry[0] += count;
        }
        Map<String, Long> emailToId = editorUserRepository.findAll().stream()
                .collect(Collectors.toMap(EditorUser::getEmail, EditorUser::getId, (a, b) -> a));
        for (Object[] row : topicPostRepository.countByAuthorEmail()) {
            String email = (String) row[0];
            Long editorId = emailToId.get(email);
            if (editorId == null) continue;
            long[] entry = map.computeIfAbsent(editorId, k -> new long[2]);
            entry[0] += ((Number) row[1]).longValue();
        }
        return map;
    }

    private List<DailyActivityDto> buildContentOverTime(Instant since, List<LiveNewsPost> livePosts, List<TopicPost> topicPosts) {
        Map<LocalDate, Long> daily = new LinkedHashMap<>();
        LocalDate start = since.atZone(ZoneOffset.UTC).toLocalDate();
        LocalDate end = LocalDate.now(ZoneOffset.UTC);
        for (LocalDate d = start; !d.isAfter(end); d = d.plusDays(1)) {
            daily.put(d, 0L);
        }
        for (LiveNewsPost post : livePosts) {
            if (post.getPublishedAt() != null) {
                LocalDate day = post.getPublishedAt().atZone(ZoneOffset.UTC).toLocalDate();
                daily.merge(day, 1L, Long::sum);
            }
        }
        for (TopicPost post : topicPosts) {
            if (post.getCreatedAt() != null) {
                LocalDate day = post.getCreatedAt().toLocalDate();
                daily.merge(day, 1L, Long::sum);
            }
        }
        return daily.entrySet().stream()
                .map(e -> {
                    DailyActivityDto dto = new DailyActivityDto();
                    dto.date = e.getKey().toString();
                    dto.count = e.getValue();
                    return dto;
                })
                .collect(Collectors.toList());
    }

    private List<EditorContentItemDto> buildTopContent(EditorUser editor, List<LiveNewsPost> livePosts, List<TopicPost> topicPosts) {
        List<EditorContentItemDto> items = new ArrayList<>();
        for (LiveNewsPost post : livePosts) {
            EditorContentItemDto dto = new EditorContentItemDto();
            dto.id = post.getId();
            dto.type = "LIVE_POST";
            dto.title = post.getHeadline();
            dto.createdAt = post.getPublishedAt();
            dto.engagement = 0L;
            items.add(dto);
        }
        for (TopicPost post : topicPosts) {
            EditorContentItemDto dto = new EditorContentItemDto();
            dto.id = post.getId();
            dto.type = "TOPIC_POST";
            dto.title = post.getTitle() != null ? post.getTitle() : post.getText();
            dto.createdAt = post.getCreatedAt() != null
                    ? post.getCreatedAt().atZone(ZoneOffset.UTC).toInstant() : null;
            dto.engagement = (long) post.getLikes();
            items.add(dto);
        }
        return items.stream()
                .sorted(Comparator.comparingLong((EditorContentItemDto i) -> i.engagement != null ? i.engagement : 0).reversed())
                .limit(5)
                .collect(Collectors.toList());
    }

    private List<TagWeightSummaryDto> buildCategoryDistribution(EditorUser editor) {
        if (editor.getFields() == null || editor.getFields().isEmpty()) {
            return List.of();
        }
        return editor.getFields().stream()
                .map(f -> {
                    TagWeightSummaryDto dto = new TagWeightSummaryDto();
                    dto.tag = f.getName();
                    dto.averageWeight = 1.0;
                    dto.userCount = 1;
                    return dto;
                })
                .collect(Collectors.toList());
    }
}
