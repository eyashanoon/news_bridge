package com.example.newscrawler.rbac;

import com.example.newscrawler.entity.UserRole;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Maps permission groups to assignable admin roles and accessible features.
 */
public final class PermissionGroups {

    public record GroupDefinition(
            String id,
            String label,
            String description,
            List<UserRole> roles,
            List<String> features
    ) {}

    private static final List<GroupDefinition> DEFINITIONS = List.of(
            new GroupDefinition(
                    "USER_MANAGEMENT",
                    "User Management",
                    "Manage registered user accounts, roles, and status",
                    List.of(UserRole.MANAGE_USERS),
                    List.of("List registered users", "Update user roles", "Suspend users", "Delete users")
            ),
            new GroupDefinition(
                    "EDITOR_MANAGEMENT",
                    "Editor Management",
                    "Review editor applications and manage editor accounts",
                    List.of(
                            UserRole.VIEW_EDITOR_REQUESTS,
                            UserRole.APPROVE_EDITOR_REQUESTS,
                            UserRole.VIEW_EDITOR_INFO,
                            UserRole.SUSPEND_EDITOR
                    ),
                    List.of("View editor requests", "Approve/reject applications", "View editor profiles", "Suspend editors")
            ),
            new GroupDefinition(
                    "CONTENT_MANAGEMENT",
                    "Content Management",
                    "Moderate and manage articles and publish approvals",
                    List.of(
                            UserRole.UPDATE_ANY_ARTICLE,
                            UserRole.DELETE_ANY_ARTICLE,
                            UserRole.APPROVE_PUBLISH_REQUESTS,
                            UserRole.READ_ARTICLE
                    ),
                    List.of("Edit any article", "Delete articles", "Approve publish requests")
            ),
            new GroupDefinition(
                    "TELEGRAM_MANAGEMENT",
                    "Telegram Management",
                    "Manage Telegram channels, posts, and crawler",
                    List.of(
                            UserRole.MANAGE_TELEGRAM_CHANNELS,
                            UserRole.VIEW_TELEGRAM_POSTS,
                            UserRole.CONTROL_TELEGRAM_CRAWLER
                    ),
                    List.of("Manage channels", "View Telegram posts", "Control Telegram crawler")
            ),
            new GroupDefinition(
                    "ANALYTICS",
                    "Analytics",
                    "View admin activity analytics and audit insights",
                    List.of(UserRole.VIEW_ADMIN_ACTIVITY),
                    List.of("Admin activity logs", "Admin analytics dashboard")
            ),
            new GroupDefinition(
                    "SYSTEM_ADMINISTRATION",
                    "System Administration",
                    "Create admins and manage platform administration",
                    List.of(UserRole.CREATE_ADMIN, UserRole.VIEW_ADMIN_ACTIVITY),
                    List.of("Create admins", "Manage admin accounts", "View audit logs")
            ),
            new GroupDefinition(
                    "API_MANAGEMENT",
                    "API Management",
                    "Access system metadata and service integrations",
                    List.of(UserRole.READ_SYSTEM_METADATA),
                    List.of("Read system metadata", "Service account integrations")
            ),
            new GroupDefinition(
                    "TOPIC_MANAGEMENT",
                    "Topic Management",
                    "Manage news events and topics",
                    List.of(UserRole.MANAGE_EVENTS),
                    List.of("Create/update topics", "Manage news events")
            ),
            new GroupDefinition(
                    "CRAWLER_MANAGEMENT",
                    "Crawler Management",
                    "Monitor and control web crawlers",
                    List.of(UserRole.VIEW_CRAWLER_LOGS, UserRole.CONTROL_CRAWLER),
                    List.of("View crawler logs", "Start/stop crawler", "Configure crawl intervals")
            )
    );

    private PermissionGroups() {}

    public static List<GroupDefinition> all() {
        return DEFINITIONS;
    }

    public static Set<String> groupsForRoles(Set<UserRole> roles) {
        Set<String> groups = new LinkedHashSet<>();
        if (roles == null || roles.isEmpty()) {
            return groups;
        }
        if (roles.contains(UserRole.OWNER)) {
            for (GroupDefinition def : DEFINITIONS) {
                groups.add(def.id());
            }
            return groups;
        }
        for (GroupDefinition def : DEFINITIONS) {
            for (UserRole role : def.roles()) {
                if (roles.contains(role)) {
                    groups.add(def.id());
                    break;
                }
            }
        }
        return groups;
    }

    public static Set<UserRole> rolesForGroups(List<String> groupIds) {
        Set<UserRole> roles = new LinkedHashSet<>();
        if (groupIds == null) {
            return roles;
        }
        for (GroupDefinition def : DEFINITIONS) {
            if (groupIds.contains(def.id())) {
                roles.addAll(def.roles());
            }
        }
        return roles;
    }

    public static Map<String, List<String>> roleToGroupsMap() {
        Map<String, List<String>> map = new LinkedHashMap<>();
        for (GroupDefinition def : DEFINITIONS) {
            for (UserRole role : def.roles()) {
                map.computeIfAbsent(role.name(), k -> new ArrayList<>()).add(def.id());
            }
        }
        return map;
    }
}
