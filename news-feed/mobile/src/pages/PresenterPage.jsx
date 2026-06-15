/**
 * PresenterPage — dedicated full-screen AI News Presenter for the mobile app.
 * Loads the avatar studio via WebView, supports receiving route params
 * from NewsBriefPage to auto-start the news brief presentation.
 */
import { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Platform,
} from "react-native";
import { WebView } from "react-native-webview";
import { API_CONFIG } from "../api/config";
import { useTheme } from "../context/ThemeContext";
import { dark as dc, th } from "../utils/darkColors";
import { useTranslation } from "react-i18next";

const PRESENTER_URL = `http://${API_CONFIG.host}:5174/avatar-studio/public/legacy.html`;

function PositionButton({ label, onPress, style, small }) {
  return (
    <TouchableOpacity
      style={[styles.posBtn, small && styles.posBtnSmall, style]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={styles.posBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function PresenterPage({ navigation, route }) {
  const { darkMode } = useTheme();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showReposition, setShowReposition] = useState(false);
  const [positionNotice, setPositionNotice] = useState("");
  const webViewRef = useRef(null);
  const postsSentRef = useRef(false);
  const noticeTimerRef = useRef(null);

  const routePosts = route?.params?.posts;

  const sendAvatarCommand = useCallback((action) => {
    if (!webViewRef.current) return;
    webViewRef.current.postMessage(
      JSON.stringify({ type: "avatar-position", action })
    );
  }, []);

  const showNotice = useCallback((message) => {
    setPositionNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setPositionNotice(""), 2200);
  }, []);

  const sendBriefPosts = useCallback(() => {
    if (!routePosts?.length || postsSentRef.current || !webViewRef.current) return;
    postsSentRef.current = true;

    setTimeout(() => {
      webViewRef.current?.postMessage(JSON.stringify({ type: "switch-tab", tab: "news-brief" }));
      setTimeout(() => {
        webViewRef.current?.postMessage(
          JSON.stringify({
            type: "news-brief",
            action: "load-posts",
            payload: { posts: routePosts },
          })
        );
        setTimeout(() => {
          webViewRef.current?.postMessage(
            JSON.stringify({ type: "news-brief", action: "read-titles" })
          );
        }, 300);
      }, 500);
    }, 1000);
  }, [routePosts]);

  const handleLoadEnd = () => {
    setLoading(false);
    sendBriefPosts();
  };

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "news-brief" && data.action === "ready") {
        sendBriefPosts();
        return;
      }
      if (data.type === "avatar-position" && data.action === "saved") {
        showNotice(t("avatarPositionSaved", "Character position saved."));
      }
    } catch {
      // Ignore non-JSON messages
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: th(darkMode, dc.bg, "#08080f") }]}>
      <StatusBar hidden />

      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
        activeOpacity={0.7}
      >
        <Text style={styles.backBtnText}>✕ {t("presenterBackToNews", "Back to News")}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.repositionToggle, showReposition && styles.repositionToggleActive]}
        onPress={() => setShowReposition((v) => !v)}
        activeOpacity={0.7}
      >
        <Text style={styles.repositionToggleText}>
          {showReposition ? "▲" : "▼"} {t("avatarReposition", "Reposition Avatar")}
        </Text>
      </TouchableOpacity>

      {showReposition && (
        <View style={styles.repositionPanel}>
          <Text style={styles.repositionTitle}>{t("avatarPositionTitle", "Move character")}</Text>
          <View style={styles.posRow}>
            <PositionButton label="◀ Left" onPress={() => sendAvatarCommand("left")} />
            <PositionButton label="▲ Up" onPress={() => sendAvatarCommand("up")} />
            <PositionButton label="Right ▶" onPress={() => sendAvatarCommand("right")} />
          </View>
          <View style={styles.posRow}>
            <PositionButton label="▼ Down" onPress={() => sendAvatarCommand("down")} />
            <PositionButton label="Forward ▲" onPress={() => sendAvatarCommand("forward")} />
            <PositionButton label="Back ▼" onPress={() => sendAvatarCommand("back")} />
          </View>
          <TouchableOpacity
            style={styles.savePosBtn}
            onPress={() => sendAvatarCommand("save")}
            activeOpacity={0.8}
          >
            <Text style={styles.savePosBtnText}>{t("avatarSavePosition", "Save Position")}</Text>
          </TouchableOpacity>
          {positionNotice ? (
            <Text style={styles.positionNotice}>{positionNotice}</Text>
          ) : null}
        </View>
      )}

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {t("presenterError", "Could not connect to the News Presenter server.")}
          </Text>
          <Text style={styles.errorHint}>
            {t("presenterHint", "Make sure the Vite dev server (port 5174) is running.")}
          </Text>
        </View>
      ) : (
        <>
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#7c6bff" />
              <Text style={styles.loadingText}>{t("presenterLoading", "Loading News Presenter...")}</Text>
            </View>
          )}
          <WebView
            ref={webViewRef}
            source={{ uri: PRESENTER_URL }}
            style={[styles.webview, loading && styles.webviewHidden]}
            onLoadStart={() => {
              setLoading(true);
              setError(false);
            }}
            onLoadEnd={handleLoadEnd}
            onError={() => {
              setLoading(false);
              setError(true);
            }}
            onMessage={handleMessage}
            javaScriptEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            allowsFullscreenVideo
            originWhitelist={["*"]}
            allowFileAccess
            allowUniversalAccessFromFileURLs
            mixedContentMode="always"
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1 },
  webviewHidden: { opacity: 0 },
  backBtn: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 36,
    right: 16,
    zIndex: 100,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  backBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  repositionToggle: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 36,
    left: 16,
    zIndex: 100,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  repositionToggleActive: {
    backgroundColor: "rgba(74,74,255,0.35)",
    borderColor: "#7a7aff",
  },
  repositionToggleText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  repositionPanel: {
    position: "absolute",
    top: Platform.OS === "ios" ? 96 : 82,
    left: 12,
    right: 12,
    zIndex: 99,
    backgroundColor: "rgba(8, 8, 24, 0.94)",
    borderWidth: 1,
    borderColor: "#2a2a5a",
    borderRadius: 12,
    padding: 12,
  },
  repositionTitle: {
    color: "#5a5aff",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    textAlign: "center",
    marginBottom: 10,
  },
  posRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  posBtn: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "#2a2a5a",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  posBtnSmall: { paddingVertical: 8 },
  posBtnText: { color: "#ddd", fontSize: 12, fontWeight: "700" },
  savePosBtn: {
    backgroundColor: "rgba(74,74,255,0.28)",
    borderWidth: 1,
    borderColor: "#5a5aff",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  savePosBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  positionNotice: {
    color: "#86efac",
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
    fontWeight: "600",
  },
  loadingContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
  },
  loadingText: { color: "#94a3b8", fontSize: 14, marginTop: 12 },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  errorText: {
    color: "#e2e8f0",
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 8,
  },
  errorHint: { color: "#64748b", fontSize: 14, textAlign: "center" },
});
