/** Permission group → role mapping (mirrors backend PermissionGroups.java) */
export const PERMISSION_GROUPS = [
  {
    id: "USER_MANAGEMENT",
    label: "User Management",
    description: "Manage registered user accounts, roles, and status",
    roles: ["MANAGE_USERS"],
    features: ["List registered users", "Update user roles", "Suspend users", "Delete users"],
  },
  {
    id: "EDITOR_MANAGEMENT",
    label: "Editor Management",
    description: "Review editor applications and manage editor accounts",
    roles: ["VIEW_EDITOR_REQUESTS", "APPROVE_EDITOR_REQUESTS", "VIEW_EDITOR_INFO", "SUSPEND_EDITOR"],
    features: ["View editor requests", "Approve/reject applications", "View editor profiles", "Suspend editors"],
  },
  {
    id: "CONTENT_MANAGEMENT",
    label: "Content Management",
    description: "Moderate and manage articles and publish approvals",
    roles: ["UPDATE_ANY_ARTICLE", "DELETE_ANY_ARTICLE", "APPROVE_PUBLISH_REQUESTS", "READ_ARTICLE"],
    features: ["Edit any article", "Delete articles", "Approve publish requests"],
  },
  {
    id: "TELEGRAM_MANAGEMENT",
    label: "Telegram Management",
    description: "Manage Telegram channels, posts, and crawler",
    roles: ["MANAGE_TELEGRAM_CHANNELS", "VIEW_TELEGRAM_POSTS", "CONTROL_TELEGRAM_CRAWLER"],
    features: ["Manage channels", "View Telegram posts", "Control Telegram crawler"],
  },
  {
    id: "ANALYTICS",
    label: "Analytics",
    description: "View admin activity analytics and audit insights",
    roles: ["VIEW_ADMIN_ACTIVITY"],
    features: ["Admin activity logs", "Admin analytics dashboard"],
  },
  {
    id: "SYSTEM_ADMINISTRATION",
    label: "System Administration",
    description: "Create admins and manage platform administration",
    roles: ["CREATE_ADMIN", "VIEW_ADMIN_ACTIVITY"],
    features: ["Create admins", "Manage admin accounts", "View audit logs"],
  },
  {
    id: "API_MANAGEMENT",
    label: "API Management",
    description: "Access system metadata and service integrations",
    roles: ["READ_SYSTEM_METADATA"],
    features: ["Read system metadata", "Service account integrations"],
  },
  {
    id: "TOPIC_MANAGEMENT",
    label: "Topic Management",
    description: "Manage news events and topics",
    roles: ["MANAGE_EVENTS"],
    features: ["Create/update topics", "Manage news events"],
  },
  {
    id: "CRAWLER_MANAGEMENT",
    label: "Crawler Management",
    description: "Monitor and control web crawlers",
    roles: ["VIEW_CRAWLER_LOGS", "CONTROL_CRAWLER"],
    features: ["View crawler logs", "Start/stop crawler", "Configure crawl intervals"],
  },
];

export const ACTIVITY_LEVELS = ["HIGH", "MEDIUM", "LOW", "INACTIVE"];

export const ACTIVITY_ACTIONS = [
  "ADMIN_CREATED",
  "ADMIN_UPDATED",
  "ADMIN_DELETED",
  "ROLE_CHANGED",
  "STATUS_CHANGED",
  "USER_MANAGEMENT",
  "TELEGRAM_MANAGEMENT",
  "TOPIC_MANAGEMENT",
  "CONTENT_MODERATION",
  "SYSTEM_CONFIG",
  "CRAWLER_MANAGEMENT",
  "ADMIN_LOGIN",
];

export const ACTION_LABELS = {
  ADMIN_CREATED: "Admin created",
  ADMIN_UPDATED: "Admin updated",
  ADMIN_DELETED: "Admin deleted",
  ROLE_CHANGED: "Roles changed",
  STATUS_CHANGED: "Status changed",
  USER_MANAGEMENT: "User management",
  TELEGRAM_MANAGEMENT: "Telegram management",
  TOPIC_MANAGEMENT: "Topics & events",
  CONTENT_MODERATION: "Content moderation",
  SYSTEM_CONFIG: "System configuration",
  CRAWLER_MANAGEMENT: "Crawler & sources",
  ADMIN_LOGIN: "Admin login",
};

export function formatActivityAction(action) {
  if (!action) return "—";
  return ACTION_LABELS[action] || action.replace(/_/g, " ").toLowerCase();
}

export function rolesFromGroups(groupIds) {
  const roles = new Set();
  for (const group of PERMISSION_GROUPS) {
    if (groupIds.includes(group.id)) {
      group.roles.forEach((r) => roles.add(r));
    }
  }
  return [...roles];
}

export function groupsFromRoles(roleList) {
  if (!roleList?.length) return [];
  if (roleList.includes("OWNER")) return PERMISSION_GROUPS.map((g) => g.id);
  const groups = new Set();
  for (const group of PERMISSION_GROUPS) {
    if (group.roles.some((r) => roleList.includes(r))) {
      groups.add(group.id);
    }
  }
  return [...groups];
}

export function groupLabel(id) {
  return PERMISSION_GROUPS.find((g) => g.id === id)?.label || id;
}
