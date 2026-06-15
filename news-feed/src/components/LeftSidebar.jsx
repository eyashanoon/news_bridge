// LeftSidebar.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSession } from "../context/SessionContext";
import {
  COMMON_CITIES,
  loadStoredLocation,
  loadUserLocationFromServer,
  saveUserLocation,
  searchLocations,
  reverseGeocode,
} from "../utils/locationUtils";

export default function LeftSidebar({ setActivePage, activePage, onLocationChange, onOpenAvatar }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { session } = useSession();
  const isEditor = session?.type === "EDITOR";
  const [location, setLocation] = useState(null);
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery) {
        setSearching(true);
        try {
          setSearchResults(await searchLocations(searchQuery));
        } catch {
          setSearchResults([]);
        }
        setSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const detectUserLocation = () => {
    setDetectingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const name = await reverseGeocode(lat, lon);
          const userLoc = { name, lat, lon, auto: true };
          setLocation(userLoc);
          await saveUserLocation(userLoc);
          onLocationChange?.();
          setDetectingLocation(false);
        },
        () => setDetectingLocation(false)
      );
    } else {
      setDetectingLocation(false);
    }
  };

  const selectCity = async (city) => {
    setLocation(city);
    await saveUserLocation(city);
    onLocationChange?.();
    setLocationMenuOpen(false);
  };

  useEffect(() => {
    loadUserLocationFromServer().then((loc) => {
      if (loc) setLocation(loc);
    });
  }, []);

  return (
    <div>
      {/* Location Selector */}
      <div className="sidebar-section">
        <div className="location-selector">
          <div className="label">{t("newsLocation")}</div>
          <div className="relative">
            <button
              onClick={() => setLocationMenuOpen(!locationMenuOpen)}
              className="location-trigger"
            >
              <div className="flex items-center gap-2">
                <span>📍</span>
                <span className="font-medium">{location ? location.name : t("selectLocation")}</span>
              </div>
              <span style={{ color: "var(--text-muted)" }}>▼</span>
            </button>

            {locationMenuOpen && (
              <div className="location-dropdown">
                <button
                  onClick={detectUserLocation}
                  disabled={detectingLocation}
                  className="location-option flex items-center gap-2 disabled:opacity-50"
                >
                  <span>{detectingLocation ? '🔄' : '📍'}</span>
                  {detectingLocation ? t("detecting") : t("autoDetectLocation")}
                </button>

                <input
                  type="text"
                  placeholder={t("searchCity")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="location-search-input"
                  autoFocus
                />

                <div className="overflow-y-auto flex-1">
                  {searching && (
                    <div className="px-4 py-2 text-sm" style={{ color: "var(--text-muted)" }}>{t("loading")}</div>
                  )}

                  {!searchQuery && !searching && COMMON_CITIES.map(city => (
                    <button
                      key={city.id}
                      onClick={() => selectCity(city)}
                      className={`location-option ${location?.id === city.id ? 'active' : ''}`}
                    >
                      {city.name}
                    </button>
                  ))}

                  {searchResults.map(result => (
                    <button
                      key={result.id}
                      onClick={() => selectCity(result)}
                      className="location-option"
                    >
                      <div className="font-medium">{result.name}</div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>{result.fullName}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {location && (
            <div className="location-active-indicator">
              <span>✓ {t("showingNewsFor")}</span>
              <strong>{location.name}</strong>
            </div>
          )}
        </div>
      </div>

      <div className="sidebar-section">
        <div
          className="sidebar-nav-item"
          onClick={() => navigate("/news/presenter")}
        >
          <span>🎙️</span>
          <span>{t("newsPresenter", "AI Presenter")}</span>
        </div>
      </div>

      <div className="sidebar-section">
        <div
          className={`sidebar-nav-item ${activePage === "HOME" ? "active" : ""}`}
          onClick={() => setActivePage("HOME")}
        >
          <span>📰</span>
          <span>{t("categoriesFeed")}</span>
        </div>

        <div
          className={`sidebar-nav-item ${activePage === "TRENDING" ? "active" : ""}`}
          onClick={() => setActivePage("TRENDING")}
        >
          <span>🔥</span>
          <span>{t("trendingTopics")}</span>
        </div>

        <div
          className={`sidebar-nav-item ${activePage === "SAVED" ? "active" : ""}`}
          onClick={() => setActivePage("SAVED")}
        >
          <span>💾</span>
          <span>{t("savedNews")}</span>
        </div>

        <div
          className={`sidebar-nav-item ${activePage === "TELEGRAM" ? "active" : ""}`}
          onClick={() => setActivePage("TELEGRAM")}
        >
          <span>📡</span>
          <span>{t("telegramSpecialNews", "Special News (Telegram)")}</span>
        </div>
      </div>

      {/* Become an Editor link - hidden for editor accounts */}
      {!isEditor && (
        <div className="sidebar-section">
          <div
            className={`sidebar-nav-item ${activePage === "APPLY_EDITOR" ? "active" : ""}`}
            onClick={() => setActivePage("APPLY_EDITOR")}
          >
            <span>✍️</span>
            <span>{t("becomeEditor")}</span>
          </div>
        </div>
      )}
    </div>
  );
}