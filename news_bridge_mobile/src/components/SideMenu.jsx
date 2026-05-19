import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import { darkColors, colors } from "../theme/colors";
import { getUserLocation } from "../api/location";
import storage from "../utils/storage";

const SCREEN_WIDTH = Dimensions.get("window").width;
const MENU_WIDTH = SCREEN_WIDTH * 0.78;

const COMMON_CITIES = [
  { id: "gaza", name: "Gaza City", lat: 31.5017, lon: 34.4668 },
  { id: "khanyounis", name: "Khan Younis", lat: 31.3453, lon: 34.3091 },
  { id: "rafah", name: "Rafah", lat: 31.2919, lon: 34.2435 },
  { id: "north_gaza", name: "North Gaza", lat: 31.5667, lon: 34.5333 },
  { id: "whole_gaza", name: "All Gaza Strip", lat: 31.4167, lon: 34.4 },
];

export default function SideMenu({
  visible,
  onClose,
  activePage,
  onNavigate,
  onLocationChange,
}) {
  const { t, i18n } = useTranslation();
  const { darkMode } = useTheme();
  const themeColors = darkMode ? darkColors : colors;
  const isArabic = i18n.language === "ar";

  const slideAnim = useRef(new Animated.Value(-MENU_WIDTH)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  const [location, setLocation] = useState(null);
  const [locationMenuOpen, setLocationMenuOpen] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Load saved location on mount
  useEffect(() => {
    const saved = storage.getJSON("user_location");
    if (saved) {
      setLocation(saved);
    }
  }, []);

  // Handle mount/unmount with animation
  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 280,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0.5,
          duration: 280,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -MENU_WIDTH,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setMounted(false);
      });
    }
  }, [visible, slideAnim, overlayOpacity, mounted]);

  const searchLocations = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10`
      );
      const data = await res.json();
      const results = data.map((item) => ({
        id: item.place_id,
        name: item.display_name.split(",")[0],
        fullName: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
      }));
      setSearchResults(results);
    } catch {
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

  const detectUserLocation = async () => {
    setDetectingLocation(true);
    try {
      const pos = await getUserLocation(true);
      if (!pos) {
        setDetectingLocation(false);
        return;
      }
      const { lat, lon } = pos;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
        );
        const data = await res.json();
        const name =
          data.address.city ||
          data.address.town ||
          data.address.village ||
          data.address.county ||
          data.address.state ||
          data.address.country ||
          "Detected Location";
        const userLoc = { name, lat, lon, auto: true };
        setLocation(userLoc);
        storage.setJSON("user_location", userLoc);
        onLocationChange?.();
      } catch {
        const userLoc = { name: "Detected Location", lat, lon, auto: true };
        setLocation(userLoc);
        storage.setJSON("user_location", userLoc);
        onLocationChange?.();
      }
    } catch {}
    setDetectingLocation(false);
  };

  const selectCity = (city) => {
    setLocation(city);
    storage.setJSON("user_location", city);
    onLocationChange?.();
    setLocationMenuOpen(false);
  };

  const handleNavigate = (page) => {
    onNavigate(page);
    onClose();
  };

  const navItems = [
    { key: "HOME", label: t("feedTitle") || "Categories / Feed", icon: "📰" },
    { key: "TRENDING", label: t("trending") || "Trending Topics", icon: "🔥" },
    { key: "SAVED", label: t("saved") || "Saved News", icon: "💾" },
  ];

  if (!mounted) return null;

  return (
    <>
      {/* Overlay */}
      <Animated.View
        style={[
          styles.overlay,
          { opacity: overlayOpacity },
        ]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
      </Animated.View>

      {/* Menu */}
      <Animated.View
        style={[
          styles.menu,
          {
            backgroundColor: themeColors.surface,
            borderRightColor: themeColors.borderLight,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.menuContent}
        >
          {/* Header */}
          <View style={styles.menuHeader}>
            <Text
              style={[
                styles.menuTitle,
                { color: themeColors.text },
                isArabic && { textAlign: "right" },
              ]}
            >
              {isArabic ? "القائمة" : "Menu"}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={[styles.closeBtnText, { color: themeColors.text }]}>
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Location Selector */}
            <View style={styles.section}>
              <Text
                style={[
                  styles.sectionLabel,
                  { color: themeColors.muted },
                  isArabic && { textAlign: "right" },
                ]}
              >
                {isArabic ? "موقع الأخبار" : "News Location"}
              </Text>

              <TouchableOpacity
                onPress={() => setLocationMenuOpen(!locationMenuOpen)}
                style={[
                  styles.locationTrigger,
                  {
                    backgroundColor: themeColors.bg,
                    borderColor: themeColors.borderLight,
                  },
                ]}
              >
                <View style={styles.locationTriggerRow}>
                  <Text style={styles.locationIcon}>📍</Text>
                  <Text
                    style={[
                      styles.locationTriggerText,
                      { color: themeColors.text },
                    ]}
                    numberOfLines={1}
                  >
                    {location ? location.name : isArabic ? "اختر موقع" : "Select Location"}
                  </Text>
                </View>
                <Text style={[styles.chevron, { color: themeColors.muted }]}>
                  ▼
                </Text>
              </TouchableOpacity>

              {locationMenuOpen && (
                <View
                  style={[
                    styles.locationDropdown,
                    {
                      backgroundColor: themeColors.bg,
                      borderColor: themeColors.borderLight,
                    },
                  ]}
                >
                  <TouchableOpacity
                    onPress={detectUserLocation}
                    disabled={detectingLocation}
                    style={styles.locationOption}
                  >
                    <Text>
                      {detectingLocation ? "🔄" : "📍"}
                    </Text>
                    <Text
                      style={[
                        styles.locationOptionText,
                        { color: themeColors.text },
                        detectingLocation && { opacity: 0.5 },
                      ]}
                    >
                      {detectingLocation
                        ? isArabic ? "جاري الكشف..." : "Detecting..."
                        : isArabic ? "كشف الموقع تلقائياً" : "Auto Detect Location"}
                    </Text>
                  </TouchableOpacity>

                  <View
                    style={[
                      styles.searchInputContainer,
                      {
                        backgroundColor: themeColors.surface,
                        borderColor: themeColors.borderLight,
                      },
                    ]}
                  >
                    <TextInput
                      placeholder={
                        isArabic
                          ? "🔍 ابحث عن مدينة، بلدة، دولة..."
                          : "🔍 Search any city, town, country..."
                      }
                      placeholderTextColor={themeColors.muted}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      style={[
                        styles.searchInput,
                        { color: themeColors.text },
                        isArabic && { textAlign: "right" },
                      ]}
                      autoFocus={false}
                    />
                  </View>

                  <ScrollView
                    style={styles.searchResultsList}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                  >
                    {searching && (
                      <View style={styles.searchingRow}>
                        <ActivityIndicator size="small" color={themeColors.muted} />
                        <Text
                          style={[styles.searchingText, { color: themeColors.muted }]}
                        >
                          {isArabic ? "جاري البحث..." : "Searching..."}
                        </Text>
                      </View>
                    )}

                    {!searchQuery &&
                      !searching &&
                      COMMON_CITIES.map((city) => (
                        <TouchableOpacity
                          key={city.id}
                          onPress={() => selectCity(city)}
                          style={[
                            styles.locationOption,
                            location?.id === city.id && {
                              backgroundColor: themeColors.brand + "15",
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.locationOptionText,
                              { color: themeColors.text },
                              location?.id === city.id && {
                                color: themeColors.brand,
                                fontWeight: "700",
                              },
                            ]}
                          >
                            {city.name}
                          </Text>
                        </TouchableOpacity>
                      ))}

                    {searchResults.map((result) => (
                      <TouchableOpacity
                        key={result.id}
                        onPress={() => selectCity(result)}
                        style={styles.locationOption}
                      >
                        <Text
                          style={[
                            styles.locationOptionText,
                            { color: themeColors.text },
                          ]}
                        >
                          {result.name}
                        </Text>
                        <Text
                          style={[
                            styles.locationSubText,
                            { color: themeColors.muted },
                          ]}
                          numberOfLines={1}
                        >
                          {result.fullName}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {location && (
                <View style={[styles.locationActive, { borderColor: themeColors.brand + "40" }]}>
                  <Text style={[styles.locationActiveText, { color: themeColors.muted }]}>
                    ✓ {isArabic ? "عرض أخبار لـ" : "Showing news for"}
                  </Text>
                  <Text style={[styles.locationActiveName, { color: themeColors.text }]}>
                    {location.name}
                  </Text>
                </View>
              )}
            </View>

            {/* Navigation Items */}
            <View style={styles.section}>
              {navItems.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  onPress={() => handleNavigate(item.key)}
                  style={[
                    styles.navItem,
                    activePage === item.key && {
                      backgroundColor: themeColors.brand + "15",
                      borderLeftWidth: 3,
                      borderLeftColor: themeColors.brand,
                    },
                  ]}
                >
                  <Text style={styles.navIcon}>{item.icon}</Text>
                  <Text
                    style={[
                      styles.navLabel,
                      { color: themeColors.text },
                      activePage === item.key && {
                        color: themeColors.brand,
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#000",
    zIndex: 100,
  },
  menu: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: MENU_WIDTH,
    zIndex: 101,
    borderRightWidth: 1,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 2, height: 0 },
  },
  menuContent: {
    flex: 1,
    paddingTop: 50,
  },
  menuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(128,128,128,0.2)",
  },
  menuTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  closeBtnText: {
    fontSize: 18,
    fontWeight: "600",
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  section: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  locationTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  locationTriggerRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8,
  },
  locationIcon: {
    fontSize: 16,
  },
  locationTriggerText: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  chevron: {
    fontSize: 10,
  },
  locationDropdown: {
    marginTop: 6,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  locationOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  locationOptionText: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  locationSubText: {
    fontSize: 11,
    marginTop: 2,
  },
  searchInputContainer: {
    marginHorizontal: 10,
    marginVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  searchInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  searchResultsList: {
    maxHeight: 200,
  },
  searchingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  searchingText: {
    fontSize: 13,
    fontWeight: "500",
  },
  locationActive: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  locationActiveText: {
    fontSize: 11,
    fontWeight: "600",
  },
  locationActiveName: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 4,
  },
  navIcon: {
    fontSize: 18,
  },
  navLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
});