import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, Image, StyleSheet, ActivityIndicator, ScrollView, Platform } from "react-native";
import { searchPosts } from "../api/searchApi";
import { apiFetch } from "../utils/apiFetch";
import { categoryTheme } from "../utils/categoryColors";
import { API_CONFIG } from "../api/config";
import TopBar from "../components/TopBar";
import { useTheme } from "../context/ThemeContext";
import { dark as dc, th } from "../utils/darkColors";
import { useTranslation } from "react-i18next";

const PLACEHOLDER_IMG = "https://media.istockphoto.com/id/1222357475/vector/image-preview-icon-picture-placeholder-for-website-or-ui-ux-design-vector-illustration.jpg?s=612x612&w=0&k=20&c=KuCo-dRBYV7nz2gbk4J9w1WtTAgpTdznHu55W9FjimE=";
const CATEGORIES = ["", "General", "Politics", "Sports", "Finance", "Medical", "Tech", "Culture", "Religion"];

function formatRelativeTime(value, t_) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays >= 7) return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  if (diffDays >= 1) return t_ ? t_("daysAgo", { count: diffDays }) : `${diffDays}d ago`;
  if (diffHours >= 1) return t_ ? t_("hoursAgo", { count: diffHours }) : `${diffHours}h ago`;
  if (diffMinutes >= 1) return t_ ? t_("minutesAgo", { count: diffMinutes }) : `${diffMinutes}m ago`;
  return t_ ? t_("justNow") : "just now";
}

function SearchResultCard({ post, onPress, darkMode, t_ }) {
  const theme = categoryTheme[post.label]?.light || categoryTheme.General.light;
  const [media, setMedia] = useState(null);

  useEffect(() => {
    if (!post.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`${API_CONFIG.baseURL}/api/posts/${post.id}/media`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) setMedia(data);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [post.id]);

  const truncate = (text, max = 120) => !text ? "" : text.length > max ? text.slice(0, max) + "..." : text;
  const imageCount = media && Array.isArray(media) ? media.length : (post.numImages || 0);
  const imagesToShow = media && Array.isArray(media)
    ? media.slice(0, 3)
    : Array.from({ length: Math.min(imageCount || 0, 3) }).map(() => ({ url: PLACEHOLDER_IMG }));
  const extraCount = Math.max(0, imageCount - 3);

  return (
    <TouchableOpacity style={[advStyles.resultItem, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]} onPress={() => onPress(post)} activeOpacity={0.8}>
      <View style={[advStyles.resultDot, { backgroundColor: theme.accent }]} />
      <View style={advStyles.resultContent}>
        <Text style={[advStyles.resultTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]} numberOfLines={1}>{post.title || "Untitled"}</Text>
        <Text style={[advStyles.resultPreview, { color: th(darkMode, dc.textSecondary, "#3d5468") }]} numberOfLines={2}>{truncate(post.text)}</Text>
        {(imageCount > 0) ? (
          <View style={advStyles.resultImages}>
            {imagesToShow.slice(0, 3).map((item, idx) => (
              <View key={idx} style={advStyles.resultImageWrapper}>
                <Image source={{ uri: item.url || PLACEHOLDER_IMG }} style={advStyles.resultImage} />
                {idx === 2 && extraCount > 0 ? (
                  <View style={advStyles.resultImageOverlay}>
                    <Text style={advStyles.resultOverlayText}>+{extraCount}</Text>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
        <View style={advStyles.resultMeta}>
          {post.label ? (
            <View style={[advStyles.resultCategory, { backgroundColor: theme.pillBg }]}>
              <Text style={[advStyles.resultCategoryText, { color: theme.pillText }]}>{post.label}</Text>
            </View>
          ) : null}
          <Text style={[advStyles.resultTime, { color: th(darkMode, dc.muted, "#6e869a") }]}>{formatRelativeTime(post.articleCreatedAt, t_)}</Text>
          {post.lang ? <Text style={[advStyles.resultLang, { color: th(darkMode, dc.textSecondary, "#64748b"), backgroundColor: th(darkMode, dc.subtle, "#f1f5f9") }]}>{post.lang}</Text> : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function AdvancedSearchPage({ navigation, route }) {
  const { darkMode } = useTheme();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchTimeout = useRef(null);

  // Filters
  const [category, setCategory] = useState("");
  const [langFilter, setLangFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("relevance");
  const [showFilters, setShowFilters] = useState(true);

  const performSearch = useCallback(async (q, filters) => {
    if (!q || q.trim().length < 1) { setResults([]); setHasSearched(false); return; }
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await searchPosts({
        query: q,
        category: filters.category,
        lang: filters.langFilter,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        sortBy: filters.sortBy,
        limit: 50,
      });
      setResults(Array.isArray(res) ? res : []);
    } catch { setResults([]); } finally { setLoading(false); }
  }, []);

  const handleSearch = () => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    performSearch(query, { category, langFilter, dateFrom, dateTo, sortBy });
  };

  const clearFilters = () => {
    setCategory("");
    setLangFilter("");
    setDateFrom("");
    setDateTo("");
    setSortBy("relevance");
  };

  const handlePostPress = (post) => {
    // Navigate back to news feed with post param to open in modal
    navigation.navigate("NewsFeed", { openPostId: post.id });
  };

  const hasActiveFilters = category || langFilter || dateFrom || dateTo || sortBy !== "relevance";

  const isRtl = i18n.language === "ar";
  const SORT_OPTIONS = [
    { value: "relevance", label: t("sortRelevance") },
    { value: "date", label: t("sortNewest") },
    { value: "popularity", label: t("sortPopular") },
  ];

  return (
    <View style={[advStyles.container, { backgroundColor: th(darkMode, dc.bg, "#f0f4f9"), direction: isRtl ? "rtl" : "ltr" }]}>
      <TopBar navigation={navigation} onMenuPress={() => {}} />
      {/* Header */}
      <View style={[advStyles.header, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderBottomColor: th(darkMode, dc.border, "#e2e8f0") }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={advStyles.backBtn}>
          <Text style={[advStyles.backBtnText, { color: th(darkMode, dc.textSecondary, "#3b82f6") }]}>{t("back")}</Text>
        </TouchableOpacity>
        <Text style={[advStyles.headerTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("advancedSearch")}</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Search Input */}
      <View style={[advStyles.searchInputRow, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderBottomColor: th(darkMode, dc.border, "#e2e8f0") }]}>
        <TextInput
          style={[advStyles.searchInput, { backgroundColor: th(darkMode, dc.subtle, "#f8faff"), borderColor: th(darkMode, dc.border, "#e2e8f0"), color: th(darkMode, dc.text, "#0b1a2b") }]}
          value={query}
          onChangeText={setQuery}
          placeholder={t("searchQuery")}
          placeholderTextColor={th(darkMode, dc.muted, "#94a3b8")}
          returnKeyType="search"
          onSubmitEditing={handleSearch}
        />
        <TouchableOpacity style={advStyles.searchBtn} onPress={handleSearch}>
          <Text style={advStyles.searchBtnText}>{t("search")}</Text>
        </TouchableOpacity>
      </View>

      {/* Toggle Filters */}
      <TouchableOpacity style={[advStyles.toggleFilters, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderBottomColor: th(darkMode, dc.border, "#e2e8f0") }]} onPress={() => setShowFilters(!showFilters)}>
        <Text style={[advStyles.toggleFiltersText, { color: th(darkMode, dc.textSecondary, "#3d5468") }]}>
          {showFilters ? t("hideFilters") : t("showFilters")} {hasActiveFilters ? "⚙️" : ""}
        </Text>
      </TouchableOpacity>

      <ScrollView style={advStyles.body} keyboardShouldPersistTaps="handled">
        {/* Filters */}
        {showFilters ? (
          <View style={[advStyles.filtersPanel, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderBottomColor: th(darkMode, dc.border, "#e2e8f0") }]}>
            <View style={advStyles.filterRow}>
              <View style={advStyles.filterGroup}>
                <Text style={[advStyles.filterLabel, { color: th(darkMode, dc.textSecondary, "#3d5468") }]}>{t("category")}</Text>
                <View style={advStyles.optionsRow}>
                  {CATEGORIES.map((cat) => {
                    const active = category === cat;
                    return (
                      <TouchableOpacity
                        key={cat || "all"}
                        style={[advStyles.filterChip, { borderColor: th(darkMode, dc.border, "#e2e8f0"), backgroundColor: th(darkMode, dc.subtle, "#f8faff") }, active && { backgroundColor: "#2563eb", borderColor: "#2563eb" }]}
                        onPress={() => setCategory(cat)}
                      >
                        <Text style={[advStyles.filterChipText, { color: th(darkMode, dc.textSecondary, "#3d5468") }, active && { color: "#fff", fontWeight: "600" }]}>
                          {cat ? t(`category_${cat}`) : t("all")}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={advStyles.filterRow}>
              <View style={advStyles.filterGroup}>
                <Text style={[advStyles.filterLabel, { color: th(darkMode, dc.textSecondary, "#3d5468") }]}>{t("allLanguages")}</Text>
                <View style={advStyles.optionsRow}>
                  {[
                    { value: "", label: t("all") },
                    { value: "en", label: t("englishLanguage") },
                    { value: "ar", label: t("arabicLanguage") },
                  ].map((opt) => {
                    const active = langFilter === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value || "all"}
                        style={[advStyles.filterChip, { borderColor: th(darkMode, dc.border, "#e2e8f0"), backgroundColor: th(darkMode, dc.subtle, "#f8faff") }, active && { backgroundColor: "#2563eb", borderColor: "#2563eb" }]}
                        onPress={() => setLangFilter(opt.value)}
                      >
                        <Text style={[advStyles.filterChipText, { color: th(darkMode, dc.textSecondary, "#3d5468") }, active && { color: "#fff", fontWeight: "600" }]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={advStyles.filterRow}>
              <View style={advStyles.filterGroup}>
                <Text style={[advStyles.filterLabel, { color: th(darkMode, dc.textSecondary, "#3d5468") }]}>{t("sortBy")}</Text>
                <View style={advStyles.optionsRow}>
                  {SORT_OPTIONS.map((opt) => {
                    const active = sortBy === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[advStyles.filterChip, { borderColor: th(darkMode, dc.border, "#e2e8f0"), backgroundColor: th(darkMode, dc.subtle, "#f8faff") }, active && { backgroundColor: "#2563eb", borderColor: "#2563eb" }]}
                        onPress={() => setSortBy(opt.value)}
                      >
                        <Text style={[advStyles.filterChipText, { color: th(darkMode, dc.textSecondary, "#3d5468") }, active && { color: "#fff", fontWeight: "600" }]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={advStyles.filterRow}>
              <View style={advStyles.dateGroup}>
                <Text style={[advStyles.filterLabel, { color: th(darkMode, dc.textSecondary, "#3d5468") }]}>{t("fromDate")}</Text>
                <TextInput
                  style={[advStyles.dateInput, { backgroundColor: th(darkMode, dc.subtle, "#f8faff"), borderColor: th(darkMode, dc.border, "#e2e8f0"), color: th(darkMode, dc.text, "#0b1a2b") }]}
                  value={dateFrom}
                  onChangeText={setDateFrom}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={th(darkMode, dc.muted, "#94a3b8")}
                />
              </View>
              <View style={advStyles.dateGroup}>
                <Text style={[advStyles.filterLabel, { color: th(darkMode, dc.textSecondary, "#3d5468") }]}>{t("toDate")}</Text>
                <TextInput
                  style={[advStyles.dateInput, { backgroundColor: th(darkMode, dc.subtle, "#f8faff"), borderColor: th(darkMode, dc.border, "#e2e8f0"), color: th(darkMode, dc.text, "#0b1a2b") }]}
                  value={dateTo}
                  onChangeText={setDateTo}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={th(darkMode, dc.muted, "#94a3b8")}
                />
              </View>
            </View>

            <View style={advStyles.filterActions}>
              <TouchableOpacity style={[advStyles.clearBtn, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]} onPress={clearFilters}>
                <Text style={[advStyles.clearBtnText, { color: th(darkMode, dc.textSecondary, "#64748b") }]}>{t("clearFilters")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Results */}
        {loading ? (
          <ActivityIndicator style={{ padding: 30 }} size="large" color="#3b82f6" />
        ) : hasSearched && results.length === 0 ? (
          <View style={advStyles.noResults}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>🔍</Text>
            <Text style={[advStyles.noResultsText, { color: th(darkMode, dc.muted, "#6e869a") }]}>{t("noResultsFound")}</Text>
            {hasActiveFilters ? (
              <TouchableOpacity style={[advStyles.clearBtn, { backgroundColor: th(darkMode, dc.surface, "#fff"), borderColor: th(darkMode, dc.border, "#e2e8f0") }]} onPress={clearFilters}>
                <Text style={[advStyles.clearBtnText, { color: th(darkMode, dc.textSecondary, "#64748b") }]}>{t("clearFilters")}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : hasSearched && results.length > 0 ? (
          <View style={advStyles.resultsSection}>
            <Text style={[advStyles.resultsCount, { color: th(darkMode, dc.muted, "#6e869a") }]}>{t("resultsCount", { count: results.length })}</Text>
            {results.map((post) => (
              <SearchResultCard key={post.id} post={post} onPress={handlePostPress} darkMode={darkMode} t_={t} />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const advStyles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { paddingVertical: 4, paddingRight: 8 },
  backBtnText: { fontSize: 16, fontWeight: "600" },
  headerTitle: { fontSize: 18, fontWeight: "700" },
  searchInputRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderBottomWidth: 1 },
  searchInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  searchBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, backgroundColor: "#2563eb" },
  searchBtnText: { fontSize: 15, fontWeight: "600", color: "#fff" },
  toggleFilters: { padding: 12, borderBottomWidth: 1 },
  toggleFiltersText: { fontSize: 14, fontWeight: "600" },
  body: { flex: 1 },
  filtersPanel: { padding: 12, borderBottomWidth: 1 },
  filterRow: { marginBottom: 12 },
  filterGroup: {},
  filterLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  optionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  dateGroup: { flex: 1, marginBottom: 8 },
  dateInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  filterActions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 4 },
  clearBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, marginTop: 8 },
  clearBtnText: { fontSize: 14, fontWeight: "600" },
  noResults: { padding: 40, alignItems: "center" },
  noResultsText: { fontSize: 16, marginBottom: 12 },
  resultsSection: { padding: 12 },
  resultsCount: { fontSize: 14, fontWeight: "600", marginBottom: 8, paddingHorizontal: 4 },
  resultItem: { flexDirection: "row", padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 1, boxShadow: "0 1px 3px rgba(0,0,0,0.04)", elevation: 1 },
  resultDot: { width: 4, borderRadius: 2, marginRight: 12 },
  resultContent: { flex: 1 },
  resultTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  resultPreview: { fontSize: 13, lineHeight: 18, marginBottom: 6 },
  resultImages: { flexDirection: "row", gap: 4, marginBottom: 6 },
  resultImageWrapper: { flex: 1, aspectRatio: 1.6, borderRadius: 6, overflow: "hidden", position: "relative" },
  resultImage: { width: "100%", height: "100%" },
  resultImageOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center" },
  resultOverlayText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  resultMeta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  resultCategory: { borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  resultCategoryText: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.04 },
  resultTime: { fontSize: 11 },
  resultLang: { fontSize: 10, fontWeight: "600", paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3, overflow: "hidden" },
});