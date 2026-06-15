// src/components/SearchBar.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { searchPosts } from "../api/searchApi";
import { apiFetch } from "../utils/apiFetch";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { categoryTheme } from "../utils/categoryColors";
import { useTheme } from "../context/ThemeContext";

const CATEGORIES = [
  { value: "", labelKey: "allCategories" },
  { value: "General", labelKey: "category_General" },
  { value: "Politics", labelKey: "category_Politics" },
  { value: "Sports", labelKey: "category_Sports" },
  { value: "Finance", labelKey: "category_Finance" },
  { value: "Medical", labelKey: "category_Medical" },
  { value: "Tech", labelKey: "category_Tech" },
  { value: "Culture", labelKey: "category_Culture" },
  { value: "Religion", labelKey: "category_Religion" },
];

const SORT_OPTIONS = [
  { value: "relevance", labelKey: "sortRelevance" },
  { value: "date", labelKey: "sortNewest" },
  { value: "popularity", labelKey: "sortPopular" },
];

export default function SearchBar() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { darkMode } = useTheme();
  const lang = i18n.language;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Filters
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [category, setCategory] = useState("");
  const [langFilter, setLangFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("relevance");

  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const searchTimeout = useRef(null);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setShowPanel(false);
        setFiltersVisible(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Ensure filters panel and results dropdown are mutually exclusive:
  // opening one will close the other to prevent overlap.
  const toggleFilters = () => {
    setFiltersVisible((prev) => {
      const next = !prev;
      if (next) setShowPanel(false);
      return next;
    });
  };

  // Open the results dropdown while closing the filters panel.
  const openResults = () => {
    setFiltersVisible(false);
    setShowPanel(true);
  };

  // Close both panels.
  const closeAll = () => {
    setShowPanel(false);
    setFiltersVisible(false);
  };


  // Debounced search
  const performSearch = useCallback(async (q, filters) => {
    if (!q || q.trim().length < 1) {
      setResults([]);
      setShowPanel(false);
      setHasSearched(false);
      return;
    }

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
        limit: 8,
      });
      setResults(Array.isArray(res) ? res : []);
      // Open results and ensure filters panel is closed.
      setFiltersVisible(false);
      setShowPanel(true);
    } catch (err) {
      console.error("Search error:", err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);

    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    if (val.trim().length >= 1) {
      searchTimeout.current = setTimeout(() => {
        performSearch(val, {
          category,
          langFilter,
          dateFrom,
          dateTo,
          sortBy,
        });
      }, 350);
    } else {
      setResults([]);
      setShowPanel(false);
      setHasSearched(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      performSearch(query, {
        category,
        langFilter,
        dateFrom,
        dateTo,
        sortBy,
      });
    }
    if (e.key === "Escape") {
      setShowPanel(false);
      setFiltersVisible(false);
      inputRef.current?.blur();
    }
  };

  const handleFocus = () => {
    if (hasSearched && results.length > 0) {
      // Re-opening results on focus: close filters to avoid overlap.
      setFiltersVisible(false);
      setShowPanel(true);
    }
  };

  const handlePostClick = (post) => {
    setShowPanel(false);
    setFiltersVisible(false);
    // Navigate to news page and open the post modal
    // We use a custom event to signal HomePage which post to open
    window.dispatchEvent(
      new CustomEvent("open-post-modal", { detail: { postId: post.id } })
    );
    navigate("/news");
  };

  const applyFiltersAndSearch = () => {
    if (query.trim().length >= 1) {
      performSearch(query, {
        category,
        langFilter,
        dateFrom,
        dateTo,
        sortBy,
      });
    }
  };

  const clearFilters = () => {
    setCategory("");
    setLangFilter("");
    setDateFrom("");
    setDateTo("");
    setSortBy("relevance");
    if (query.trim().length >= 1) {
      performSearch(query, {
        category: "",
        langFilter: "",
        dateFrom: "",
        dateTo: "",
        sortBy: "relevance",
      });
    }
  };

  const hasActiveFilters = category || langFilter || dateFrom || dateTo || sortBy !== "relevance";

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setShowPanel(false);
    setHasSearched(false);
    setFiltersVisible(false);
    inputRef.current?.focus();
  };

  return (
    <div className="search-bar-wrapper" ref={panelRef}>
      <div className="search-bar-input-group">
        <span className="search-bar-icon">🔍</span>
        <input
          ref={inputRef}
          type="text"
          className="search-bar-input"
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          aria-label={t("searchPlaceholder")}
        />
        {query && (
          <button className="search-bar-clear" onClick={clearSearch} aria-label="Clear search">
            ✕
          </button>
        )}
        <button
          className={`search-bar-filter-toggle ${hasActiveFilters ? "has-filters" : ""}`}
          onClick={toggleFilters}
          title={t("advancedFilters")}
          aria-label={t("advancedFilters")}
        >
          ⚙️
        </button>
      </div>

      {/* Advanced Filters Panel */}
      {filtersVisible && (
        <div className="search-filters-panel">
          <div className="search-filters-row">
            <div className="search-filter-group">
              <label>{t("category")}</label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                }}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {t(cat.labelKey)}
                  </option>
                ))}
              </select>
            </div>

            <div className="search-filter-group">
              <label>{t("language")}</label>
              <select
                value={langFilter}
                onChange={(e) => setLangFilter(e.target.value)}
              >
                <option value="">{t("allLanguages")}</option>
                <option value="en">English</option>
                <option value="ar">العربية</option>
              </select>
            </div>

            <div className="search-filter-group">
              <label>{t("sortBy")}</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.labelKey)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="search-filters-row">
            <div className="search-filter-group">
              <label>{t("dateFrom")}</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                max={dateTo || undefined}
              />
            </div>

            <div className="search-filter-group">
              <label>{t("dateTo")}</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                min={dateFrom || undefined}
              />
            </div>
          </div>

          <div className="search-filters-actions">
            <button className="btn btn-primary btn-sm" onClick={applyFiltersAndSearch}>
              {t("applyFilters")}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
              {t("clearFilters")}
            </button>
          </div>
        </div>
      )}

      {/* Results Dropdown */}
      {showPanel && (
        <div className="search-results-dropdown">
          {loading ? (
            <div className="search-loading">{t("searching")}</div>
          ) : results.length === 0 ? (
            <div className="search-no-results">
              <span className="search-no-results-icon">🔍</span>
              <span>{t("noSearchResults")}</span>
              {hasActiveFilters && (
                <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
                  {t("clearFilters")}
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="search-results-header">
                <span className="search-results-count">
                  {results.length} {t("results")}
                </span>
                {hasActiveFilters && (
                  <button className="btn btn-ghost btn-sm" onClick={clearFilters}>
                    {t("clearFilters")}
                  </button>
                )}
              </div>
              <div className="search-results-list">
                {results.map((post) => (
                  <SearchResultItem
                    key={post.id}
                    post={post}
                    onClick={() => handlePostClick(post)}
                    darkMode={darkMode}
                    lang={lang}
                    t={t}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

const PLACEHOLDER_IMG =
  "https://media.istockphoto.com/id/1222357475/vector/image-preview-icon-picture-placeholder-for-website-or-ui-ux-design-vector-illustration.jpg?s=612x612&w=0&k=20&c=KuCo-dRBYV7nz2gbk4J9w1WtTAgpTdznHu55W9FjimE=";

function SearchResultItem({ post, onClick, darkMode, lang, t }) {
  const theme = darkMode ? "dark" : "light";
  const postTheme = categoryTheme[post.label]?.[theme] || categoryTheme.General[theme];
  const dotColor = postTheme?.accent || "var(--brand-500)";

  const publishedLabel = formatRelativeTime(post.articleCreatedAt, lang);

  const truncate = (text, max = 120) => {
    if (!text) return "";
    return text.length > max ? text.slice(0, max) + "..." : text;
  };

  const [media, setMedia] = useState(null);

  useEffect(() => {
    if (!post.id) return;
    let cancelled = false;
    const loadMedia = async () => {
      try {
        const res = await apiFetch(`/api/posts/${post.id}/media`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data)) setMedia(data);
      } catch (err) {
        // silently ignore
      }
    };
    loadMedia();
    return () => { cancelled = true; };
  }, [post.id]);

  const imageCount = media && Array.isArray(media) ? media.length : (post.numImages || 0);
  const showImages = imageCount > 0;
  const imagesToShow = media && Array.isArray(media)
    ? media.slice(0, 3)
    : Array.from({ length: Math.min(imageCount, 3) }).map(() => ({ url: PLACEHOLDER_IMG }));
  const extraCount = Math.max(0, imageCount - 3);

  return (
    <div className="search-result-item" onClick={onClick}>
      <div
        className="search-result-category-dot"
        style={{
          background: dotColor,
        }}
      />
      <div className="search-result-content">
        <div className="search-result-title">{post.title || t("untitledPost")}</div>
        <div className="search-result-preview">{truncate(post.text)}</div>

        {showImages && (
          <div className="search-result-images">
            {imagesToShow.map((item, idx) => {
              if (idx === 2 && extraCount > 0) {
                return (
                  <div key={idx} className="search-result-image-wrapper" style={{ position: 'relative' }}>
                    {item.type === 'video' ? (
                      <div className="search-result-image search-result-video-thumb">
                        <span className="search-result-video-label">▶</span>
                      </div>
                    ) : (
                      <img className="search-result-image" src={item.url} alt="" />
                    )}
                    <div style={{
                      position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: '1.2rem', fontWeight: 800,
                      fontFamily: 'var(--font-display)',
                    }}>+{extraCount}</div>
                  </div>
                );
              }
              return (
                <div key={idx} className="search-result-image-wrapper">
                  {item.type === 'video' ? (
                    <div className="search-result-image search-result-video-thumb">
                      <span className="search-result-video-label">▶</span>
                    </div>
                  ) : (
                    <img className="search-result-image" src={item.url} alt="" />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="search-result-meta">
          {post.label && (
            <span
              className="search-result-category"
              style={{
                background: postTheme?.pillBg || "var(--brand-500)",
                color: postTheme?.pillText || "#ffffff",
              }}
            >
              {t(`category_${post.label}`, post.label)}
            </span>
          )}
          <span className="search-result-time">{publishedLabel}</span>
          {post.lang && <span className="search-result-lang">{post.lang}</span>}
          {post.tags && post.tags.length > 0 && (
            <span className="search-result-tags">
              {post.tags.slice(0, 2).map((tag, idx) => (
                <span key={idx} className="search-result-tag">#{tag}</span>
              ))}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function formatRelativeTime(value, lang) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays >= 7) {
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  if (lang === "ar") {
    if (diffDays >= 1) return `منذ ${diffDays} أيام`;
    if (diffHours >= 1) return `منذ ${diffHours} ساعات`;
    if (diffMinutes >= 1) return `منذ ${diffMinutes} دقائق`;
    return "الآن";
  }
  if (diffDays >= 1) return `${diffDays}d ago`;
  if (diffHours >= 1) return `${diffHours}h ago`;
  if (diffMinutes >= 1) return `${diffMinutes}m ago`;
  return "just now";
}