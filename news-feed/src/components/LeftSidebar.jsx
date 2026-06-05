// LeftSidebar.jsx
import { useState, useEffect } from 'react';
import { useTranslation } from "react-i18next";

export default function LeftSidebar({ setActivePage, activePage, onLocationChange, onOpenAvatar, isAvatarOpen }) {
  const { t } = useTranslation();
  const sessionStr = localStorage.getItem("nf_token");
  const isEditor = (() => {
    try {
      const parts = sessionStr?.split(".");
      if (parts?.length >= 2) {
        const payload = JSON.parse(atob(parts[1]));
        return payload?.type === "EDITOR";
      }
    } catch {}
    return false;
  })();
  const [location, setLocation] = useState(null);
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const commonCities = [
    { id: 'gaza', name: 'Gaza City', lat: 31.5017, lon: 34.4668 },
    { id: 'khanyounis', name: 'Khan Younis', lat: 31.3453, lon: 34.3091 },
    { id: 'rafah', name: 'Rafah', lat: 31.2919, lon: 34.2435 },
    { id: 'north_gaza', name: 'North Gaza', lat: 31.5667, lon: 34.5333 },
    { id: 'whole_gaza', name: 'All Gaza Strip', lat: 31.4167, lon: 34.4000 },
  ];

  const searchLocations = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10`);
      const data = await res.json();
      const results = data.map(item => ({
        id: item.place_id,
        name: item.display_name.split(',')[0],
        fullName: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon)
      }));
      setSearchResults(results);
    } catch (e) {
      setSearchResults([]);
    }
    setSearching(false);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchLocations(searchQuery);
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
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
            const data = await res.json();
            const name = data.address.city || data.address.town || data.address.village || data.address.county || data.address.state || data.address.country || 'Detected Location';
            const userLoc = { name, lat, lon, auto: true };
            setLocation(userLoc);
            localStorage.setItem('user_location', JSON.stringify(userLoc));
            onLocationChange?.();
          } catch (e) {
            const userLoc = { name: 'Detected Location', lat, lon, auto: true };
            setLocation(userLoc);
            localStorage.setItem('user_location', JSON.stringify(userLoc));
            onLocationChange?.();
          }
          setDetectingLocation(false);
        },
        () => {
          setDetectingLocation(false);
        }
      );
    }
  };

  const selectCity = (city) => {
    setLocation(city);
    localStorage.setItem('user_location', JSON.stringify(city));
    onLocationChange?.();
    setLocationMenuOpen(false);
  };

  useEffect(() => {
    const saved = localStorage.getItem('user_location');
    if (saved) {
      setLocation(JSON.parse(saved));
    }
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

                  {!searchQuery && !searching && commonCities.map(city => (
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
          <span>{t("savedNewsNav")}</span>
        </div>

        <div
          className={`sidebar-nav-item ${activePage === "AVATAR" || isAvatarOpen ? "active" : ""}`}
          onClick={() => onOpenAvatar?.()}
        >
          <span>🤖</span>
          <span>{t("aiPresenter")}</span>
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