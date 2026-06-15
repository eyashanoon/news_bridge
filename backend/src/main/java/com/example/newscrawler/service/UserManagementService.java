package com.example.newscrawler.service;

import com.example.newscrawler.dto.EditorUserResponse;
import com.example.newscrawler.dto.FrontendUserListResponse;
import com.example.newscrawler.dto.FrontendUserResponse;
import com.example.newscrawler.dto.PagedResponse;
import com.example.newscrawler.dto.RegisteredUserResponse;
import com.example.newscrawler.dto.UserActivityMetricsDto;
import com.example.newscrawler.entity.EditorUser;
import com.example.newscrawler.entity.RegisteredUser;
import com.example.newscrawler.entity.UserRole;
import com.example.newscrawler.entity.UserStatus;
import com.example.newscrawler.entity.UserType;
import com.example.newscrawler.repository.EditorAttachmentRepository;
import com.example.newscrawler.repository.EditorRequestRepository;
import com.example.newscrawler.repository.EditorUserRepository;
import com.example.newscrawler.repository.LiveNewsPostRepository;
import com.example.newscrawler.repository.RegisteredUserRepository;
import com.example.newscrawler.repository.TopicPostRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class UserManagementService {

    @Autowired
    private RegisteredUserRepository registeredUserRepository;

    @Autowired
    private EditorUserRepository editorUserRepository;

    @Autowired
    private EditorAttachmentRepository editorAttachmentRepository;

    @Autowired
    private UserActivityMetricsService activityMetricsService;

    @Autowired
    private LiveNewsPostRepository liveNewsPostRepository;

    @Autowired
    private TopicPostRepository topicPostRepository;

    @Autowired
    private EditorRequestRepository editorRequestRepository;

    public PagedResponse<FrontendUserResponse> searchFrontendUsers(String search, int page, int size) {
        PagedResponse<FrontendUserListResponse> result = searchFrontendUsersList(
                search, null, null, null, null, "name", "asc", page, size);
        List<FrontendUserResponse> items = result.items().stream()
                .map(this::toSimpleFrontendUser)
                .collect(Collectors.toList());
        return new PagedResponse<>(items, result.total(), result.page(), result.size(), result.totalPages());
    }

    public PagedResponse<FrontendUserListResponse> searchFrontendUsersList(
            String search,
            String status,
            String accountType,
            String roleType,
            String activityLevel,
            String sortKey,
            String sortDir,
            int page,
            int size) {

        Map<Long, UserActivityMetricsDto> metrics = activityMetricsService.getAllMetrics();
        Map<Long, long[]> contributions = loadEditorContributions();

        List<FrontendUserListResponse> all = new ArrayList<>();
        registeredUserRepository.findAll().stream()
                .filter(u -> !(u instanceof EditorUser))
                .map(u -> toFrontendListUser(u, metrics.get(u.getId()), null))
                .forEach(all::add);
        editorUserRepository.findAll().stream()
                .map(u -> toFrontendListUser(u, metrics.get(u.getId()), contributions.get(u.getId())))
                .forEach(all::add);

        List<FrontendUserListResponse> filtered = applyFrontendFilters(all, search, status, accountType, roleType, activityLevel);
        sortFrontendUsers(filtered, sortKey, sortDir);
        return paginate(filtered, page, size);
    }

    public PagedResponse<RegisteredUserResponse> searchRegisteredUsers(
            String search,
            String status,
            String roleType,
            String activityLevel,
            String sortKey,
            String sortDir,
            int page,
            int size) {

        Map<Long, UserActivityMetricsDto> metrics = activityMetricsService.getAllMetrics();
        List<RegisteredUserResponse> all = registeredUserRepository.findAll().stream()
                .filter(u -> !(u instanceof EditorUser))
                .map(u -> mapRegistered(u, metrics.get(u.getId())))
                .collect(Collectors.toList());

        List<RegisteredUserResponse> filtered = applyRegisteredFilters(all, search, status, roleType, activityLevel);
        sortRegistered(filtered, sortKey, sortDir);

        return paginate(filtered, page, size);
    }

    public PagedResponse<EditorUserResponse> searchEditorUsers(
            String search,
            String status,
            String activityLevel,
            String roleLevel,
            String sortKey,
            String sortDir,
            int page,
            int size) {

        Map<Long, UserActivityMetricsDto> metrics = activityMetricsService.getAllMetrics();
        Map<Long, long[]> contributions = loadEditorContributions();

        List<EditorUserResponse> all = editorUserRepository.findAll().stream()
                .map(u -> mapEditor(u, metrics.get(u.getId()), contributions.get(u.getId())))
                .collect(Collectors.toList());

        List<EditorUserResponse> filtered = applyEditorFilters(all, search, status, activityLevel, roleLevel);
        sortEditors(filtered, sortKey, sortDir);

        return paginate(filtered, page, size);
    }

    public RegisteredUserResponse mapRegistered(RegisteredUser u, UserActivityMetricsDto metrics) {
        RegisteredUserResponse r = new RegisteredUserResponse();
        r.id = u.getId();
        r.username = u.getUsername();
        r.fullName = u.getFullName();
        r.email = u.getEmail();
        r.type = u.getType() != null ? u.getType().name() : "REGISTERED";
        r.status = u.getStatus() != null ? u.getStatus().name() : null;
        r.active = u.getStatus() == UserStatus.ACTIVE;
        r.roles = u.getRoles().stream().map(Enum::name).collect(Collectors.toSet());
        r.createdAt = u.getCreatedAt();
        r.roleType = resolveRoleType(u.getRoles());
        if (metrics != null) {
            r.lastActivityAt = metrics.lastActivityAt;
            r.activityScore = metrics.activityScore;
            r.activityLevel = metrics.activityLevel;
        } else {
            r.activityScore = 0.0;
            r.activityLevel = "INACTIVE";
        }
        return r;
    }

    public EditorUserResponse mapEditorWithContributions(EditorUser u, UserActivityMetricsDto metrics) {
        Map<Long, long[]> contributions = loadEditorContributions();
        return mapEditor(u, metrics, contributions.get(u.getId()));
    }

    public EditorUserResponse mapEditor(EditorUser u, UserActivityMetricsDto metrics, long[] contribution) {
        EditorUserResponse r = new EditorUserResponse();
        r.id = u.getId();
        r.username = u.getUsername();
        r.fullName = u.getFullName();
        r.email = u.getEmail();
        r.type = u.getType() != null ? u.getType().name() : "EDITOR";
        r.status = u.getStatus() != null ? u.getStatus().name() : null;
        r.active = u.getStatus() == UserStatus.ACTIVE;
        r.roles = u.getRoles().stream().map(Enum::name).collect(Collectors.toSet());
        r.fieldName = (u.getFields() != null && !u.getFields().isEmpty())
                ? u.getFields().stream().map(f -> f.getName()).collect(Collectors.joining(", "))
                : null;
        r.phone = u.getPhone();
        r.profilePicture = u.getProfilePicture();
        r.experience = u.getExperience();
        r.references = u.getReferences();
        r.attachments = editorAttachmentRepository.findByEditorUserId(u.getId())
                .stream()
                .map(a -> a.getFileUrl())
                .collect(Collectors.toList());
        r.createdAt = u.getCreatedAt();
        if (metrics != null) {
            r.lastActivityAt = metrics.lastActivityAt;
            r.activityScore = metrics.activityScore;
            r.activityLevel = metrics.activityLevel;
        } else {
            r.activityScore = 0.0;
            r.activityLevel = "INACTIVE";
        }
        if (contribution != null) {
            r.contributionCount = contribution[0];
            if (contribution[1] > 0) {
                r.lastContributionAt = Instant.ofEpochMilli(contribution[1]);
            }
        } else {
            r.contributionCount = 0L;
        }
        r.approvalStatus = resolveApprovalStatus(u);
        r.roleLevel = resolveRoleLevel(u);
        editorRequestRepository.findFirstByUser_IdAndStatusOrderByUpdatedAtDesc(u.getId(), "APPROVED")
                .ifPresent(req -> r.editorRequestId = req.getId());
        if (u.getFields() != null) {
            r.assignedCategoryIds = u.getFields().stream()
                    .map(f -> f.getId())
                    .collect(Collectors.toList());
        }
        return r;
    }

    private String resolveRoleLevel(EditorUser u) {
        Set<UserRole> roles = u.getRoles();
        if (roles.contains(UserRole.MANAGE_USERS) || roles.contains(UserRole.CREATE_ADMIN)) {
            return "Admin-assigned";
        }
        if (roles.contains(UserRole.DELETE_LIVE_NEWS) && roles.contains(UserRole.EDIT_LIVE_NEWS)) {
            return "Senior";
        }
        if (u.getStatus() == UserStatus.ACTIVE
                && editorRequestRepository.findFirstByUser_IdAndStatusOrderByUpdatedAtDesc(u.getId(), "APPROVED").isPresent()) {
            return "Verified";
        }
        return "Junior";
    }

    private String resolveApprovalStatus(EditorUser u) {
        if (u.getStatus() == UserStatus.SUSPENDED) return "SUSPENDED";
        if (u.getStatus() == UserStatus.PENDING_ACTIVATION) return "PENDING";
        return "ACTIVE";
    }

    private String resolveRoleType(Set<UserRole> roles) {
        if (roles == null || roles.isEmpty()) return "user";
        if (roles.contains(UserRole.CREATE_ADMIN) || roles.contains(UserRole.MANAGE_USERS)) {
            return "admin-linked";
        }
        if (roles.contains(UserRole.PUBLISH_LIVE_NEWS) || roles.contains(UserRole.EDIT_LIVE_NEWS)) {
            return "editor";
        }
        return "user";
    }

    private Map<Long, long[]> loadEditorContributions() {
        Map<Long, long[]> map = new HashMap<>();
        for (Object[] row : liveNewsPostRepository.aggregateByAuthor()) {
            Long editorId = (Long) row[0];
            long count = ((Number) row[1]).longValue();
            Instant lastAt = row[2] != null ? (Instant) row[2] : null;
            long[] entry = map.computeIfAbsent(editorId, id -> new long[2]);
            entry[0] += count;
            if (lastAt != null) {
                long ms = lastAt.toEpochMilli();
                if (entry[1] == 0 || ms > entry[1]) entry[1] = ms;
            }
        }
        Map<String, Long> emailToId = editorUserRepository.findAll().stream()
                .collect(Collectors.toMap(EditorUser::getEmail, EditorUser::getId, (a, b) -> a));
        for (Object[] row : topicPostRepository.countByAuthorEmail()) {
            String email = (String) row[0];
            long count = ((Number) row[1]).longValue();
            Long editorId = emailToId.get(email);
            if (editorId == null) continue;
            long[] entry = map.computeIfAbsent(editorId, id -> new long[2]);
            entry[0] += count;
        }
        return map;
    }

    private List<RegisteredUserResponse> applyRegisteredFilters(
            List<RegisteredUserResponse> rows,
            String search,
            String status,
            String roleType,
            String activityLevel) {

        String q = search != null ? search.trim().toLowerCase() : "";
        return rows.stream()
                .filter(u -> q.isEmpty()
                        || String.valueOf(u.id).contains(q)
                        || (u.email != null && u.email.toLowerCase().contains(q))
                        || (u.username != null && u.username.toLowerCase().contains(q))
                        || (u.fullName != null && u.fullName.toLowerCase().contains(q)))
                .filter(u -> status == null || status.isBlank() || status.equals(u.status))
                .filter(u -> roleType == null || roleType.isBlank() || roleType.equalsIgnoreCase(u.roleType))
                .filter(u -> activityLevel == null || activityLevel.isBlank()
                        || activityLevel.equalsIgnoreCase(u.activityLevel))
                .collect(Collectors.toList());
    }

    private List<EditorUserResponse> applyEditorFilters(
            List<EditorUserResponse> rows,
            String search,
            String status,
            String activityLevel,
            String roleLevel) {

        String q = search != null ? search.trim().toLowerCase() : "";
        return rows.stream()
                .filter(u -> q.isEmpty()
                        || String.valueOf(u.id).contains(q)
                        || (u.email != null && u.email.toLowerCase().contains(q))
                        || (u.username != null && u.username.toLowerCase().contains(q))
                        || (u.fullName != null && u.fullName.toLowerCase().contains(q)))
                .filter(u -> status == null || status.isBlank() || status.equals(u.status))
                .filter(u -> activityLevel == null || activityLevel.isBlank()
                        || activityLevel.equalsIgnoreCase(u.activityLevel))
                .filter(u -> roleLevel == null || roleLevel.isBlank()
                        || roleLevel.equalsIgnoreCase(u.roleLevel))
                .collect(Collectors.toList());
    }

    private void sortRegistered(List<RegisteredUserResponse> rows, String sortKey, String sortDir) {
        Comparator<RegisteredUserResponse> cmp;
        if ("name".equalsIgnoreCase(sortKey)) {
            cmp = Comparator.comparing(u -> u.fullName != null ? u.fullName : (u.username != null ? u.username : u.email),
                    String.CASE_INSENSITIVE_ORDER);
        } else if ("lastActivityAt".equalsIgnoreCase(sortKey)) {
            cmp = Comparator.comparing(u -> u.lastActivityAt != null ? u.lastActivityAt : Instant.EPOCH);
        } else {
            cmp = Comparator.comparing(u -> u.createdAt != null ? u.createdAt : Instant.EPOCH);
        }
        if ("desc".equalsIgnoreCase(sortDir)) {
            cmp = cmp.reversed();
        }
        rows.sort(cmp);
    }

    private void sortEditors(List<EditorUserResponse> rows, String sortKey, String sortDir) {
        Comparator<EditorUserResponse> cmp;
        if ("name".equalsIgnoreCase(sortKey)) {
            cmp = Comparator.comparing(u -> u.fullName != null ? u.fullName : (u.username != null ? u.username : u.email),
                    String.CASE_INSENSITIVE_ORDER);
        } else if ("lastActivityAt".equalsIgnoreCase(sortKey)) {
            cmp = Comparator.comparing(u -> u.lastActivityAt != null ? u.lastActivityAt : Instant.EPOCH);
        } else if ("contributions".equalsIgnoreCase(sortKey)) {
            cmp = Comparator.comparingLong(u -> u.contributionCount != null ? u.contributionCount : 0L);
        } else {
            cmp = Comparator.comparing(u -> u.createdAt != null ? u.createdAt : Instant.EPOCH);
        }
        if ("desc".equalsIgnoreCase(sortDir)) {
            cmp = cmp.reversed();
        }
        rows.sort(cmp);
    }

    private FrontendUserListResponse toFrontendListUser(RegisteredUser u, UserActivityMetricsDto metrics, long[] contribution) {
        FrontendUserListResponse r = new FrontendUserListResponse();
        r.id = u.getId();
        r.username = u.getUsername();
        r.fullName = u.getFullName();
        r.email = u.getEmail();
        r.active = u.getStatus() == UserStatus.ACTIVE;
        r.roles = u.getRoles().stream().map(Enum::name).collect(Collectors.toSet());
        r.createdAt = u.getCreatedAt();
        r.status = u.getStatus() != null ? u.getStatus().name() : null;

        if (u instanceof EditorUser editor) {
            r.type = "EDITOR";
            r.roleLevel = resolveRoleLevel(editor);
            r.fieldName = (editor.getFields() != null && !editor.getFields().isEmpty())
                    ? editor.getFields().stream().map(f -> f.getName()).collect(Collectors.joining(", "))
                    : null;
            if (contribution != null) {
                r.contributionCount = contribution[0];
            } else {
                r.contributionCount = 0L;
            }
        } else {
            r.type = u.getType() != null ? u.getType().name() : "REGISTERED";
            r.roleType = resolveRoleType(u.getRoles());
        }

        if (metrics != null) {
            r.lastActivityAt = metrics.lastActivityAt;
            r.activityScore = metrics.activityScore;
            r.activityLevel = metrics.activityLevel;
        } else {
            r.activityScore = 0.0;
            r.activityLevel = "INACTIVE";
        }
        return r;
    }

    private FrontendUserResponse toSimpleFrontendUser(FrontendUserListResponse u) {
        FrontendUserResponse r = new FrontendUserResponse();
        r.id = u.id;
        r.username = u.username;
        r.fullName = u.fullName;
        r.email = u.email;
        r.type = u.type;
        r.status = u.status;
        r.createdAt = u.createdAt;
        r.lastActivityAt = u.lastActivityAt;
        r.activityScore = u.activityScore;
        r.activityLevel = u.activityLevel;
        return r;
    }

    private List<FrontendUserListResponse> applyFrontendFilters(
            List<FrontendUserListResponse> rows,
            String search,
            String status,
            String accountType,
            String roleType,
            String activityLevel) {

        String q = search != null ? search.trim().toLowerCase() : "";
        return rows.stream()
                .filter(u -> q.isEmpty()
                        || String.valueOf(u.id).contains(q)
                        || (u.email != null && u.email.toLowerCase().contains(q))
                        || (u.username != null && u.username.toLowerCase().contains(q))
                        || (u.fullName != null && u.fullName.toLowerCase().contains(q)))
                .filter(u -> status == null || status.isBlank() || status.equals(u.status))
                .filter(u -> accountType == null || accountType.isBlank()
                        || accountType.equalsIgnoreCase(u.type))
                .filter(u -> roleType == null || roleType.isBlank()
                        || ("EDITOR".equals(u.type) && roleType.equalsIgnoreCase(u.roleLevel))
                        || (!"EDITOR".equals(u.type) && roleType.equalsIgnoreCase(u.roleType)))
                .filter(u -> activityLevel == null || activityLevel.isBlank()
                        || activityLevel.equalsIgnoreCase(u.activityLevel))
                .collect(Collectors.toList());
    }

    private void sortFrontendUsers(List<FrontendUserListResponse> rows, String sortKey, String sortDir) {
        Comparator<FrontendUserListResponse> cmp;
        if ("name".equalsIgnoreCase(sortKey)) {
            cmp = Comparator.comparing(u -> u.fullName != null ? u.fullName
                    : (u.username != null ? u.username : u.email), String.CASE_INSENSITIVE_ORDER);
        } else if ("lastActivityAt".equalsIgnoreCase(sortKey)) {
            cmp = Comparator.comparing(u -> u.lastActivityAt != null ? u.lastActivityAt : Instant.EPOCH);
        } else if ("contributions".equalsIgnoreCase(sortKey)) {
            cmp = Comparator.comparingLong(u -> u.contributionCount != null ? u.contributionCount : 0L);
        } else if ("activityScore".equalsIgnoreCase(sortKey)) {
            cmp = Comparator.comparingDouble(u -> u.activityScore != null ? u.activityScore : 0.0);
        } else {
            cmp = Comparator.comparing(u -> u.createdAt != null ? u.createdAt : Instant.EPOCH);
        }
        if ("desc".equalsIgnoreCase(sortDir)) {
            cmp = cmp.reversed();
        }
        rows.sort(cmp);
    }

    private <T> PagedResponse<T> paginate(List<T> rows, int page, int size) {
        int safeSize = Math.max(1, Math.min(size, 100));
        int safePage = Math.max(0, page);
        int total = rows.size();
        int totalPages = Math.max(1, (int) Math.ceil((double) total / safeSize));
        int from = Math.min(safePage * safeSize, total);
        int to = Math.min(from + safeSize, total);
        return new PagedResponse<>(rows.subList(from, to), total, safePage, safeSize, totalPages);
    }
}
