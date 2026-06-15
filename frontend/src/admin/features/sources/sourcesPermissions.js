import { hasRole } from "../../utils/roles";

/** Maps spec permissions to existing RBAC roles (backward compatible). */
export function canViewEndpoints(session) {
  return hasRole(session, "VIEW_CRAWLER_LOGS", "CONTROL_CRAWLER", "MANAGE_USERS", "OWNER");
}

export function canCreateEndpoints(session) {
  return hasRole(session, "CONTROL_CRAWLER", "OWNER");
}

export function canUpdateEndpoints(session) {
  return hasRole(session, "CONTROL_CRAWLER", "OWNER");
}

export function canDeleteEndpoints(session) {
  return hasRole(session, "CONTROL_CRAWLER", "OWNER");
}

export function canManageEndpoints(session) {
  return canCreateEndpoints(session) && canUpdateEndpoints(session) && canDeleteEndpoints(session);
}
