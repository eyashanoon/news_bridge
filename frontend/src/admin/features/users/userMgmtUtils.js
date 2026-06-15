import { displayNameFromEmail } from "../../utils/avatars";

export function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
}

export function formatRelativeDate(value) {
  if (!value) return "Never";
  try {
    const date = new Date(value);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    return formatDate(value);
  } catch {
    return value;
  }
}

export function activityTone(level) {
  if (level === "HIGH") return "approved";
  if (level === "MEDIUM") return "pending";
  if (level === "LOW") return "default";
  return "rejected";
}

export function statusTone(status) {
  const normalized = (status || "").toUpperCase();
  if (normalized === "ACTIVE") return "active";
  if (normalized === "SUSPENDED") return "suspended";
  if (normalized === "PENDING_ACTIVATION") return "pending";
  return "default";
}

export function displayUserName(user) {
  return user?.fullName || user?.username || displayNameFromEmail(user?.email);
}

export function formatActivityScore(user) {
  if (!user?.lastActivityAt && (user?.activityScore == null || user.activityScore === 0)) {
    return "—";
  }
  return Math.round(user.activityScore ?? 0);
}

export function formatDuration(seconds) {
  if (!seconds) return "0s";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

export function segmentLabel(segment) {
  return (segment || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isEditor(user) {
  return user?.type === "EDITOR";
}
