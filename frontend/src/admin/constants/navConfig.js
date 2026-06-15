/**
 * Grouped admin navigation. Routes unchanged from legacy App.jsx.
 */
export const NAV_GROUPS = [
  {
    id: "overview",
    label: "Overview",
    icon: "layoutDashboard",
    items: [
      {
        id: "dashboard",
        to: "/admin",
        label: "Dashboard",
        icon: "layoutDashboard",
        roles: [],
        exact: true,
      },
    ],
  },
  {
    id: "people",
    label: "People & Access",
    icon: "users",
    items: [
      {
        id: "admins",
        to: "/admin/admins",
        label: "Admins",
        icon: "userCog",
        roles: ["CREATE_ADMIN", "MANAGE_USERS", "VIEW_ADMIN_ACTIVITY"],
      },
      {
        id: "users",
        to: "/admin/users",
        label: "Users",
        icon: "users",
        roles: ["MANAGE_USERS"],
      },
      {
        id: "editors",
        to: "/admin/editors",
        label: "Editors",
        icon: "fileEdit",
        roles: ["MANAGE_USERS", "VIEW_EDITOR_INFO"],
        matchPaths: ["/admin/editors"],
      },
      {
        id: "roles",
        label: "Roles & Permissions",
        icon: "keyRound",
        roles: ["CREATE_ADMIN", "MANAGE_USERS"],
        comingSoon: true,
      },
      {
        id: "editor-requests",
        to: "/admin/editor-requests",
        label: "Editor Requests",
        icon: "fileEdit",
        roles: ["VIEW_EDITOR_REQUESTS"],
      },
    ],
  },
  {
    id: "content",
    label: "Content",
    icon: "newspaper",
    items: [
      {
        id: "articles",
        to: "/admin/articles",
        label: "Articles",
        icon: "newspaper",
        roles: ["UPDATE_ANY_ARTICLE", "DELETE_ANY_ARTICLE"],
      },
      {
        id: "topics-fields",
        to: "/admin/topics",
        label: "Topics & Fields",
        icon: "tags",
        matchPaths: ["/admin/topics", "/admin/fields"],
        roles: ["MANAGE_EVENTS", "MANAGE_USERS", "APPROVE_EDITOR_REQUESTS"],
      },
    ],
  },
  {
    id: "telegram",
    label: "Telegram Intelligence",
    icon: "send",
    items: [
      {
        id: "telegram",
        to: "/admin/telegram",
        label: "Telegram Control Center",
        icon: "send",
        roles: ["MANAGE_TELEGRAM_CHANNELS", "VIEW_TELEGRAM_POSTS", "MANAGE_USERS"],
      },
    ],
  },
  {
    id: "infrastructure",
    label: "Infrastructure",
    icon: "globe",
    items: [
      {
        id: "crawl-sources",
        to: "/admin/roots",
        label: "Crawl Sources",
        icon: "globe",
        matchPaths: ["/admin/roots", "/admin/endpoints"],
        roles: ["MANAGE_USERS", "OWNER"],
      },
      {
        id: "crawler",
        to: "/admin/crawler",
        label: "Crawler Control",
        icon: "bot",
        roles: ["VIEW_CRAWLER_LOGS", "CONTROL_CRAWLER"],
      },
    ],
  },
  {
    id: "system",
    label: "System",
    icon: "settings",
    items: [
      {
        id: "api-security",
        label: "API Security",
        icon: "lock",
        roles: [],
        comingSoon: true,
      },
    ],
  },
];

export const ROUTE_META = {
  "/admin": { title: "Dashboard", group: "Overview" },
  "/admin/admins": { title: "Admins", group: "People & Access" },
  "/admin/users": { title: "Users", group: "People & Access" },
  "/admin/editors": { title: "Editors", group: "People & Access" },
  "/admin/editor-requests": { title: "Editor Requests", group: "People & Access" },
  "/admin/articles": { title: "Articles", group: "Content" },
  "/admin/topics": { title: "Topics & Fields", group: "Content" },
  "/admin/fields": { title: "Topics & Fields", group: "Content" },
  "/admin/telegram": { title: "Telegram Control Center", group: "Telegram Intelligence" },
  "/admin/roots": { title: "Crawl Sources", group: "Infrastructure" },
  "/admin/endpoints": { title: "Crawl Sources", group: "Infrastructure" },
  "/admin/crawler": { title: "Crawler Control", group: "Infrastructure" },
};

/** Returns true when a nav item matches the current pathname. */
export function isNavItemActive(item, pathname) {
  if (item.comingSoon || item.suppressActive || !item.to) return false;

  const paths = item.matchPaths || [item.to];
  return paths.some((path) => {
    if (item.exact || path === "/admin") return pathname === path;
    return pathname === path || pathname.startsWith(`${path}/`);
  });
}

/** Find the group containing the active route, if any. */
export function findActiveGroupId(pathname, groups = NAV_GROUPS) {
  for (const group of groups) {
    if (group.items.some((item) => isNavItemActive(item, pathname))) {
      return group.id;
    }
  }
  return null;
}

/** Filter groups/items by role visibility. */
export function getVisibleNavGroups(roles = []) {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => hasNavItemAccess(roles, item)),
  })).filter((group) => group.items.length > 0);
}

function hasNavItemAccess(roles, item) {
  if (!item.roles?.length) return true;
  return item.roles.some((role) => roles.includes(role));
}

/** Resolve link target for items that map to multiple legacy routes. */
export function resolveNavItemTarget(item, roles = []) {
  if (!item.to) return item.to;

  if (item.id === "topics-fields") {
    const canTopics = roles.some((r) => ["MANAGE_EVENTS", "MANAGE_USERS"].includes(r));
    return canTopics ? "/admin/topics" : "/admin/fields";
  }

  return item.to;
}
