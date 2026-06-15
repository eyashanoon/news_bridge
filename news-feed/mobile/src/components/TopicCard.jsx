import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../context/ThemeContext";
import { dark as dc, th } from "../utils/darkColors";
import { useTranslation } from "react-i18next";

function formatTimeAgo(isoString, t) {
  if (!isoString) return null;
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return t("justNow");
  if (diffMin < 60) return t("minutesAgo", { count: diffMin });
  if (diffHrs < 24) return t("hoursAgo", { count: diffHrs });
  return t("daysAgo", { count: diffDays });
}

export default function TopicCard({ topic, onViewTopic }) {
  const { darkMode } = useTheme();
  const { t } = useTranslation();
  const lastActivity = formatTimeAgo(topic.lastActivityAt, t);

  const translateField = (name) => {
    return t(`field_${name}`, { defaultValue: name });
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[styles.card, { backgroundColor: th(darkMode, dc.surface, "#ffffff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]}
      onPress={() => onViewTopic(topic.id)}
    >
      {/* Title + Trending Indicator */}
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: th(darkMode, dc.text, "#0b1a2b") }]} numberOfLines={2}>{topic.title}</Text>
        <View style={styles.growthBadge}>
          <Text style={styles.growthText}>🔥 {topic.growth}%</Text>
        </View>
      </View>

      {/* Fields */}
      {topic.fieldNames && topic.fieldNames.length > 0 && (
        <View style={styles.fieldsRow}>
          <Text style={styles.fieldsLabel}>📌</Text>
          {topic.fieldNames.map((fn, idx) => (
            <View key={idx} style={styles.fieldBadge}>
              <Text style={styles.fieldBadgeText}>{translateField(fn)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Summary */}
      {topic.description ? (
        <Text style={[styles.summary, { color: th(darkMode, dc.textSecondary, "#3d5468") }]} numberOfLines={3}>{topic.description}</Text>
      ) : null}

      {/* Stats */}
      <View style={styles.statsRow}>
        <Text style={[styles.stat, { color: th(darkMode, dc.muted, "#6e869a") }]}>📝 {topic.posts} {t("posts")}</Text>
        <Text style={[styles.stat, { color: th(darkMode, dc.muted, "#6e869a") }]}>👥 {topic.contributors} {t("contributors")}</Text>
      </View>

      {/* Trending Statistics */}
      <View style={styles.trendingStats}>
        {topic.totalLikes > 0 && (
          <Text style={[styles.trendStat, { color: th(darkMode, dc.muted, "#6e869a") }]}>👍 {topic.totalLikes} {t("likes")}</Text>
        )}
        {topic.totalDislikes > 0 && (
          <Text style={[styles.trendStat, { color: th(darkMode, dc.muted, "#6e869a") }]}>👎 {topic.totalDislikes} {t("dislikes")}</Text>
        )}
        {topic.activityScore > 0 && (
          <Text style={[styles.trendStat, { color: th(darkMode, dc.muted, "#6e869a") }]}>⚡ {t("activityScore")}: {topic.activityScore}</Text>
        )}
        {lastActivity && (
          <Text style={[styles.trendStat, { color: th(darkMode, dc.muted, "#6e869a") }]}>🕐 {lastActivity}</Text>
        )}
      </View>

      {/* Tags */}
      {topic.tags && topic.tags.length > 0 && (
        <View style={[styles.tagsRow, { backgroundColor: th(darkMode, dc.subtle, "#f5f8fd") }]}>
          {topic.tags.map((tag, idx) => (
            <View key={idx} style={styles.tag}>
              <Text style={[styles.tagText, { color: th(darkMode, dc.muted, "#6e869a") }]}>#{tag}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Buttons */}
      <View style={[styles.footer, { borderTopColor: th(darkMode, dc.subtle, "#f1f5f9") }]}>
        <TouchableOpacity onPress={() => onViewTopic(topic.id)} style={styles.viewBtn}>
          <Text style={styles.viewBtnText}>{t("viewTopic")}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 14,
    padding: 16,
    boxShadow: "0 1px 3px rgba(11,26,43,0.06)",
    elevation: 2,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#0b1a2b",
    lineHeight: 24,
  },
  growthBadge: {
    backgroundColor: "#fff7ed",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  growthText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ea580c",
  },
  fieldsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  fieldsLabel: { fontSize: 14 },
  fieldBadge: {
    backgroundColor: "#f0f9ff",
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  fieldBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0284c7",
  },
  summary: {
    fontSize: 14,
    lineHeight: 20,
    color: "#3d5468",
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 6,
  },
  stat: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6e869a",
  },
  trendingStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 8,
  },
  trendStat: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6e869a",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  tag: {
    backgroundColor: "#f5f8fd",
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6e869a",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-start",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  viewBtn: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  viewBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2563eb",
  },
});