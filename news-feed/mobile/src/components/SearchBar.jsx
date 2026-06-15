import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, Image, StyleSheet, ActivityIndicator } from "react-native";
import { searchPosts, getPostById } from "../api/searchApi";
import { apiFetch } from "../utils/apiFetch";
import { categoryTheme } from "../utils/categoryColors";
import { API_CONFIG } from "../api/config";
import { useTheme } from "../context/ThemeContext";
import { dark as dc, th } from "../utils/darkColors";
import { useTranslation } from "react-i18next";

const PLACEHOLDER_IMG = "https://media.istockphoto.com/id/1222357475/vector/image-preview-icon-picture-placeholder-for-website-or-ui-ux-design-vector-illustration.jpg?s=612x612&w=0&k=20&c=KuCo-dRBYV7nz2gbk4J9w1WtTAgpTdznHu55W9FjimE=";

function formatRelativeTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays >= 7) return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (diffDays >= 1) return `${diffDays}d ago`;
  if (diffHours >= 1) return `${diffHours}h ago`;
  if (diffMinutes >= 1) return `${diffMinutes}m ago`;
  return "just now";
}

function SearchResultCard({ post, onPress, darkMode }) {
  const theme = categoryTheme[post.label]?.light || categoryTheme.General.light;
  const [media, setMedia] = useState(null);

  useEffect(() => {
    if (!post.id) return;
    let cancelled = false;
    const loadMedia = async () => {
      try {
        const res = await apiFetch(`${API_CONFIG.baseURL}/api/posts/${post.id}/media`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) setMedia(data);
      } catch {}
    };
    loadMedia();
    return () => { cancelled = true; };
  }, [post.id]);

  const truncate = (text, max = 120) => !text ? "" : text.length > max ? text.slice(0, max) + "..." : text;
  const imageCount = media && Array.isArray(media) ? media.length : (post.numImages || 0);
  const imagesToShow = media && Array.isArray(media)
    ? media.slice(0, 3)
    : Array.from({ length: Math.min(imageCount, 3) }).map(() => ({ url: PLACEHOLDER_IMG }));
  const extraCount = Math.max(0, imageCount - 3);

  return (
    <TouchableOpacity style={[styles.resultItem, { borderBottomColor: th(darkMode, dc.subtle, "#f1f5f9") }]} onPress={() => onPress(post)} activeOpacity={0.8}>
      <View style={[styles.resultDot, { backgroundColor: theme.accent }]} />
      <View style={styles.resultContent}>
          <Text style={[styles.resultTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]} numberOfLines={1}>{post.title || "Untitled"}</Text>
        <Text style={[styles.resultPreview, { color: th(darkMode, dc.textSecondary, "#3d5468") }]} numberOfLines={2}>{truncate(post.text)}</Text>

        {imageCount > 0 ? (
          <View style={styles.resultImages}>
            {imagesToShow.slice(0, 3).map((item, idx) => (
              <View key={idx} style={styles.resultImageWrapper}>
                <Image source={{ uri: item.url || PLACEHOLDER_IMG }} style={styles.resultImage} />
                {idx === 2 && extraCount > 0 ? (
                  <View style={styles.resultImageOverlay}>
                    <Text style={styles.resultOverlayText}>+{extraCount}</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.resultMeta}>
          {post.label ? (
            <View style={[styles.resultCategory, { backgroundColor: theme.pillBg }]}>
              <Text style={[styles.resultCategoryText, { color: theme.pillText }]}>{post.label}</Text>
            </View>
          ) : null}
          <Text style={[styles.resultTime, { color: th(darkMode, dc.muted, "#6e869a") }]}>{formatRelativeTime(post.articleCreatedAt)}</Text>
          {post.lang ? <Text style={[styles.resultLang, { color: th(darkMode, dc.textSecondary, "#64748b"), backgroundColor: th(darkMode, dc.subtle, "#f1f5f9") }]}>{post.lang}</Text> : null}
          {post.tags?.length > 0 ? (
            <View style={styles.resultTags}>
              {post.tags.slice(0, 2).map((tag, idx) => (
                <Text key={idx} style={[styles.resultTag, { color: th(darkMode, dc.textSecondary, "#64748b") }]}>#{tag}</Text>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function SearchBar({ onPostPress, onAdvancedSearch }) {
  const { darkMode } = useTheme();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeout = useRef(null);

  const performSearch = useCallback(async (q) => {
    if (!q || q.trim().length < 1) { setResults([]); setShowResults(false); return; }
    setLoading(true);
    try {
      const res = await searchPosts({ query: q, limit: 8 });
      setResults(Array.isArray(res) ? res : []);
      setShowResults(true);
    } catch { setResults([]); } finally { setLoading(false); }
  }, []);

  const handleChange = (val) => {
    setQuery(val);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (val.trim().length >= 1) {
      searchTimeout.current = setTimeout(() => performSearch(val), 350);
    } else { setResults([]); setShowResults(false); }
  };

  const handleSelect = (post) => { setShowResults(false); setQuery(""); onPostPress?.(post); };

  return (
    <View style={styles.wrapper}>
      <View style={[styles.inputGroup, { backgroundColor: th(darkMode, dc.subtle, "#f5f8fd"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]}>
        <Text style={styles.icon}>🔍</Text>
        <TextInput
          style={[styles.input, { color: th(darkMode, dc.text, "#0b1a2b") }]}
          placeholder={t("searchPlaceholder")}
          placeholderTextColor={th(darkMode, dc.muted, "#6e869a")}
          value={query}
          onChangeText={handleChange}
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <TouchableOpacity onPress={() => { setQuery(""); setResults([]); setShowResults(false); }}>
           <Text style={[styles.clearBtn, { color: th(darkMode, dc.muted, "#6e869a") }]}>✕</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={onAdvancedSearch} style={styles.advancedBtn}>
          <Text style={styles.advancedBtnText}>⚙️</Text>
        </TouchableOpacity>
      </View>
      {showResults ? (
        <View style={[styles.dropdown, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]}>
          {loading ? (
            <ActivityIndicator style={styles.loader} size="small" color="#64748b" />
          ) : results.length === 0 ? (
            <View style={styles.noResults}>
              <Text style={styles.noResultsIcon}>🔍</Text>
              <Text style={[styles.noResultsText, { color: th(darkMode, dc.muted, "#6e869a") }]}>{t("noSearchResults")}</Text>
            </View>
          ) : (
            <FlatList
              data={results}
              renderItem={({ item }) => <SearchResultCard post={item} onPress={handleSelect} darkMode={darkMode} />}
              keyExtractor={item => String(item.id)}
              style={styles.resultList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: "relative", zIndex: 100 },
  inputGroup: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#f5f8fd",
    borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", paddingHorizontal: 12, height: 40,
  },
  icon: { fontSize: 16, marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: "#0b1a2b", paddingVertical: 0 },
  clearBtn: { fontSize: 16, color: "#6e869a", paddingLeft: 8 },
  advancedBtn: { paddingLeft: 8, paddingVertical: 4 },
  advancedBtnText: { fontSize: 18 },
  dropdown: {
    position: "absolute", top: 46, left: 0, right: 0, backgroundColor: "#fff",
    borderRadius: 12, borderWidth: 1, borderColor: "#e2e8f0", elevation: 6, maxHeight: 400,
    zIndex: 200,
  },
  loader: { padding: 20 },
  noResults: { padding: 24, alignItems: "center" },
  noResultsIcon: { fontSize: 24, marginBottom: 8 },
  noResultsText: { fontSize: 14, color: "#6e869a" },
  resultList: { maxHeight: 360 },
      resultItem: { flexDirection: "row", padding: 12, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" },
  resultDot: { width: 4, borderRadius: 2, marginRight: 10 },
  resultContent: { flex: 1 },
  resultTitle: { fontSize: 14, fontWeight: "600", color: "#0b1a2b", marginBottom: 4 },
  resultPreview: { fontSize: 13, color: "#3d5468", lineHeight: 18, marginBottom: 6 },
  resultImages: { flexDirection: "row", gap: 4, marginBottom: 6 },
  resultImageWrapper: { flex: 1, aspectRatio: 1.5, borderRadius: 6, overflow: "hidden", position: "relative" },
  resultImage: { width: "100%", height: "100%" },
  resultImageOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center" },
  resultOverlayText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  resultMeta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  resultCategory: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  resultCategoryText: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.04 },
  resultTime: { fontSize: 11, color: "#6e869a" },
  resultLang: { fontSize: 10, fontWeight: "600", color: "#64748b", backgroundColor: "#f1f5f9", paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, overflow: "hidden" },
  resultTags: { flexDirection: "row", gap: 4 },
  resultTag: { fontSize: 10, color: "#64748b" },
});