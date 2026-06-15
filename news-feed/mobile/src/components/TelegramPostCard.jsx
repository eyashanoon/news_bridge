import { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet, Linking } from "react-native";
import { useTranslation } from "react-i18next";
import { getUserId } from "../utils/userId";
import { apiFetch } from "../utils/apiFetch";
import { ensureUserInitialized } from "../utils/auth";
import { formatRelativeTime } from "../utils/formatRelativeTime";
import { useTheme } from "../context/ThemeContext";
import { dark as dc, th } from "../utils/darkColors";

const CONTENT_COLLAPSE_LEN = 420;
const ACCENT = "#2563eb";

function channelInitials(name) {
  if (!name) return "TG";
  const parts = name.replace(/^@/, "").split(/[\s_]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function TelegramText({ text, textColor, codeBg, linkColor }) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|https?:\/\/[^\s]+)/g);
  return (
    <Text style={{ color: textColor, lineHeight: 22, fontSize: 15 }}>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <Text key={i} style={{ fontWeight: "700" }}>{part.slice(2, -2)}</Text>;
        }
        if (part.startsWith("__") && part.endsWith("__")) {
          return <Text key={i} style={{ fontStyle: "italic" }}>{part.slice(2, -2)}</Text>;
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <Text key={i} style={{ fontFamily: "monospace", backgroundColor: codeBg, fontSize: 14 }}>
              {part.slice(1, -1)}
            </Text>
          );
        }
        if (/^https?:\/\//.test(part)) {
          return (
            <Text key={i} style={{ color: linkColor }} onPress={() => Linking.openURL(part)}>
              {part}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}

function MediaBlock({ mediaUrl, mediaType, darkMode, t }) {
  const [hidden, setHidden] = useState(false);
  if (!mediaUrl || hidden) return null;
  const type = (mediaType || "").toLowerCase();
  const isVideo = type.includes("video") || /\.(mp4|webm|mov)(\?|$)/i.test(mediaUrl);

  if (isVideo) {
    return (
      <TouchableOpacity
        style={[styles.mediaVideo, { backgroundColor: th(darkMode, dc.subtle, "#0f172a") }]}
        onPress={() => Linking.openURL(mediaUrl)}
        activeOpacity={0.8}
      >
        <Text style={styles.mediaVideoIcon}>▶</Text>
        <Text style={[styles.mediaVideoLabel, { color: th(darkMode, dc.textMuted, "#94a3b8") }]}>
          {t("telegramFeed.tapToPlayVideo", "Tap to play video")}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <Image
      source={{ uri: mediaUrl }}
      style={styles.mediaImage}
      resizeMode="cover"
      onError={() => setHidden(true)}
    />
  );
}

export default function TelegramPostCard({
  post,
  showChannelProfile = false,
  showMatchBadge = false,
  onTagClick,
  isVisible = false,
}) {
  const { t, i18n } = useTranslation();
  const { darkMode } = useTheme();
  const isRtl = i18n.language === "ar";
  const viewSent = useRef(false);
  const visibleStart = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const channelName = post.channelDisplayName || post.channelUsername || t("telegramFeed.channel", "Channel");
  const handle = post.channelUsername?.replace(/^@/, "");
  const telegramUrl = handle ? `https://t.me/${handle}` : null;
  const relativeDate = formatRelativeTime(post.messageDate, i18n.language);
  const isLong = (post.content?.length || 0) > CONTENT_COLLAPSE_LEN;
  const displayContent =
    !isLong || expanded ? post.content : `${post.content.slice(0, CONTENT_COLLAPSE_LEN).trim()}…`;

  const textColor = th(darkMode, dc.text, "#0f172a");
  const mutedColor = th(darkMode, dc.textMuted, "#64748b");
  const cardBg = th(darkMode, dc.cardBg, "#fff");
  const borderColor = th(darkMode, dc.cardBorder, "#e2e8f0");
  const codeBg = th(darkMode, "rgba(255,255,255,0.08)", "rgba(0,0,0,0.06)");
  const linkColor = th(darkMode, "#60a5fa", ACCENT);
  const tagBg = th(darkMode, "rgba(96,165,250,0.12)", "rgba(37,99,235,0.08)");
  const tagBorder = th(darkMode, "rgba(96,165,250,0.25)", "rgba(37,99,235,0.15)");
  const tagColor = th(darkMode, "#93c5fd", ACCENT);
  const matchBg = th(darkMode, "rgba(34,197,94,0.2)", "rgba(34,197,94,0.12)");
  const matchColor = th(darkMode, "#86efac", "#15803d");

  const sendView = async () => {
    if (viewSent.current || !post.channelId) return;
    viewSent.current = true;
    try {
      await ensureUserInitialized();
      const userId = (await getUserId()) || "android-app-anonymous";
      const scoreParam = post.score != null ? `&feedScore=${post.score}` : "";
      await apiFetch(
        `/api/telegram/interactions/view?userId=${encodeURIComponent(userId)}&channelId=${post.channelId}&postId=${post.id}${scoreParam}`,
        { method: "POST" }
      );
    } catch {
      // non-blocking
    }
  };

  const sendTimeSpent = async (seconds) => {
    if (!post.channelId || seconds < 1) return;
    try {
      await ensureUserInitialized();
      const userId = (await getUserId()) || "android-app-anonymous";
      await apiFetch(
        `/api/telegram/interactions/time?userId=${encodeURIComponent(userId)}&channelId=${post.channelId}&postId=${post.id}&seconds=${seconds}`,
        { method: "POST" }
      );
    } catch {
      // non-blocking
    }
  };

  useEffect(() => {
    if (isVisible) {
      visibleStart.current = Date.now();
      sendView();
    } else if (visibleStart.current) {
      const seconds = (Date.now() - visibleStart.current) / 1000;
      visibleStart.current = null;
      if (seconds > 1) sendTimeSpent(seconds);
    }
  }, [isVisible, post.id, post.channelId]);

  useEffect(() => {
    return () => {
      if (visibleStart.current) {
        const seconds = (Date.now() - visibleStart.current) / 1000;
        visibleStart.current = null;
        if (seconds > 1) sendTimeSpent(seconds);
      }
    };
  }, [post.id, post.channelId]);

  return (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
      <View style={styles.header}>
        <View style={styles.channelRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{channelInitials(channelName)}</Text>
          </View>
          <View style={styles.channelInfo}>
            <Text style={[styles.channelName, { color: textColor }]} numberOfLines={1}>{channelName}</Text>
            {handle ? (
              <Text style={[styles.channelHandle, { color: mutedColor }]}>@{handle}</Text>
            ) : null}
          </View>
        </View>
        <View style={[styles.meta, { alignItems: isRtl ? "flex-start" : "flex-end" }]}>
          {showMatchBadge && post.score != null && post.score > 0 && (
            <View style={[styles.matchBadge, { backgroundColor: matchBg }]}>
              <Text style={[styles.matchBadgeText, { color: matchColor }]}>
                {t("telegramFeed.similar", "Similar")}
              </Text>
            </View>
          )}
          <Text style={[styles.date, { color: mutedColor }]}>{relativeDate}</Text>
        </View>
      </View>

      {post.content ? (
        <View style={styles.contentWrap}>
          <TelegramText text={displayContent} textColor={textColor} codeBg={codeBg} linkColor={linkColor} />
          {isLong ? (
            <TouchableOpacity onPress={() => setExpanded((v) => !v)}>
              <Text style={[styles.readMore, { color: linkColor }]}>
                {expanded ? t("showLess", "Show less") : t("readMore", "Read more")}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      <MediaBlock mediaUrl={post.mediaUrl} mediaType={post.mediaType} darkMode={darkMode} t={t} />

      {post.tags?.length > 0 ? (
        <View style={[styles.tags, { flexDirection: isRtl ? "row-reverse" : "row" }]}>
          {post.tags.map((tag) =>
            onTagClick ? (
              <TouchableOpacity
                key={tag}
                style={[styles.tag, styles.tagClickable, { backgroundColor: tagBg, borderColor: tagBorder }]}
                onPress={() => onTagClick(tag)}
              >
                <Text style={[styles.tagText, { color: tagColor }]}>#{tag}</Text>
              </TouchableOpacity>
            ) : (
              <View key={tag} style={[styles.tag, { backgroundColor: tagBg, borderColor: tagBorder }]}>
                <Text style={[styles.tagText, { color: tagColor }]}>#{tag}</Text>
              </View>
            )
          )}
        </View>
      ) : null}

      {showChannelProfile && post.channelDescription ? (
        <View style={[styles.channelDetails, { backgroundColor: th(darkMode, "rgba(255,255,255,0.05)", "rgba(0,0,0,0.03)") }]}>
          <TouchableOpacity onPress={() => setDetailsOpen((v) => !v)}>
            <Text style={[styles.channelDetailsSummary, { color: textColor }]}>
              {detailsOpen ? "▼ " : isRtl ? "◀ " : "▶ "}{t("telegramFeed.aboutChannel", "About this channel")}
            </Text>
          </TouchableOpacity>
          {detailsOpen ? (
            <Text style={[styles.channelDetailsBody, { color: mutedColor }]}>{post.channelDescription}</Text>
          ) : null}
        </View>
      ) : null}

      <View style={[styles.footer, { borderTopColor: borderColor }]}>
        <View style={[styles.footerLeft, { flexDirection: isRtl ? "row-reverse" : "row" }]}>
          {post.viewCount != null && post.viewCount > 0 ? (
            <Text style={[styles.views, { color: mutedColor }]}>
              👁 {post.viewCount.toLocaleString()}
            </Text>
          ) : null}
          {post.edited ? (
            <Text style={[styles.edited, { color: mutedColor }]}>{t("edited", "edited")}</Text>
          ) : null}
        </View>
        {telegramUrl ? (
          <TouchableOpacity onPress={() => Linking.openURL(telegramUrl)}>
            <Text style={[styles.openTg, { color: linkColor }]}>
              {t("telegramFeed.openInTelegram", "Open channel")}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  channelRow: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#6366f1",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  channelInfo: { flex: 1, minWidth: 0 },
  channelName: { fontWeight: "600", fontSize: 15 },
  channelHandle: { fontSize: 12, marginTop: 1 },
  meta: { gap: 4 },
  matchBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  matchBadgeText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  date: { fontSize: 12 },
  contentWrap: { marginBottom: 4 },
  readMore: { marginTop: 6, fontSize: 14, fontWeight: "600" },
  mediaImage: { width: "100%", height: 200, borderRadius: 10, marginTop: 10 },
  mediaVideo: {
    width: "100%",
    height: 160,
    borderRadius: 10,
    marginTop: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  mediaVideoIcon: { fontSize: 32, color: "#fff" },
  mediaVideoLabel: { fontSize: 13 },
  tags: { flexWrap: "wrap", gap: 6, marginTop: 10 },
  tag: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3 },
  tagClickable: {},
  tagText: { fontSize: 12 },
  channelDetails: { marginTop: 10, borderRadius: 8, padding: 10 },
  channelDetailsSummary: { fontWeight: "600", fontSize: 13 },
  channelDetailsBody: { marginTop: 6, fontSize: 13, lineHeight: 19 },
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  footerLeft: { flexWrap: "wrap", alignItems: "center", gap: 10, flex: 1 },
  views: { fontSize: 12 },
  edited: { fontSize: 12, fontStyle: "italic" },
  openTg: { fontSize: 12, fontWeight: "600" },
});
