import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Modal,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import { dark as dc, th } from "../utils/darkColors";
import {
  COMMON_CITIES,
  loadStoredLocation,
  loadUserLocationFromServer,
  saveUserLocation,
  searchLocations,
  reverseGeocode,
} from "../utils/locationUtils";

async function detectDeviceLocation() {
  try {
    const Location = await import("expo-location");
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") throw new Error("permission denied");
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { lat: pos.coords.latitude, lon: pos.coords.longitude };
  } catch {
    return new Promise((resolve, reject) => {
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
          reject
        );
      } else {
        reject(new Error("geolocation unavailable"));
      }
    });
  }
}

function LocationPickerContent({ onLocationSaved, onClose }) {
  const { t } = useTranslation();
  const { darkMode } = useTheme();
  const [location, setLocation] = useState(null);
  const [detecting, setDetecting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadUserLocationFromServer().then((loc) => {
      if (loc) setLocation(loc);
    });
  }, []);

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        setSearchResults(await searchLocations(searchQuery));
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const persistLocation = useCallback(async (loc) => {
    setLocation(loc);
    await saveUserLocation(loc);
    onLocationSaved?.(loc);
    onClose?.();
    setSearchQuery("");
    setSearchResults([]);
  }, [onLocationSaved, onClose]);

  const detectLocation = async () => {
    setDetecting(true);
    try {
      const { lat, lon } = await detectDeviceLocation();
      const name = await reverseGeocode(lat, lon);
      await persistLocation({ name, lat, lon, auto: true });
    } catch {
      // user can pick manually
    } finally {
      setDetecting(false);
    }
  };

  const borderColor = th(darkMode, dc.border, "#e2e8f0");
  const textColor = th(darkMode, dc.text, "#0b1a2b");
  const mutedColor = th(darkMode, dc.muted, "#64748b");
  const surfaceColor = th(darkMode, dc.surface, "#fff");

  return (
    <View>
      <TouchableOpacity style={[styles.detectBtn, { borderColor }]} onPress={detectLocation} disabled={detecting}>
        <Text style={styles.detectIcon}>{detecting ? "🔄" : "📍"}</Text>
        <Text style={[styles.detectText, { color: textColor }]}>
          {detecting ? t("detecting") : t("autoDetectLocation")}
        </Text>
      </TouchableOpacity>

      <TextInput
        style={[styles.searchInput, { borderColor, color: textColor }]}
        placeholder={t("searchCity")}
        placeholderTextColor={mutedColor}
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {location && (
        <Text style={[styles.activeHint, { color: mutedColor }]}>
          ✓ {t("showingNewsFor")} <Text style={{ fontWeight: "700", color: textColor }}>{location.name}</Text>
        </Text>
      )}

      <ScrollView style={styles.results} nestedScrollEnabled keyboardShouldPersistTaps="handled">
        {searching && <ActivityIndicator style={{ padding: 8 }} color={mutedColor} />}

        {!searchQuery && !searching && COMMON_CITIES.map((city) => (
          <TouchableOpacity
            key={city.id}
            style={[styles.option, location?.id === city.id && styles.optionActive]}
            onPress={() => persistLocation(city)}
          >
            <Text style={[styles.optionText, { color: textColor }]}>{city.name}</Text>
          </TouchableOpacity>
        ))}

        {searchResults.map((result) => (
          <TouchableOpacity key={result.id} style={styles.option} onPress={() => persistLocation(result)}>
            <Text style={[styles.optionText, { color: textColor }]}>{result.name}</Text>
            <Text style={[styles.optionSub, { color: mutedColor }]} numberOfLines={1}>{result.fullName}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

/** Inline location picker for the sidebar */
export default function LocationPicker() {
  const { t } = useTranslation();
  const { darkMode, bumpFeedRefresh } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [location, setLocation] = useState(null);

  useEffect(() => {
    loadStoredLocation().then((loc) => {
      if (loc) setLocation(loc);
    });
  }, []);

  const textColor = th(darkMode, dc.text, "#0b1a2b");
  const mutedColor = th(darkMode, dc.muted, "#64748b");
  const surfaceColor = th(darkMode, dc.surface, "#fff");
  const borderColor = th(darkMode, dc.border, "#e2e8f0");

  return (
    <View style={[styles.section, { borderBottomColor: th(darkMode, dc.subtle, "#f1f5f9") }]}>
      <Text style={[styles.label, { color: mutedColor }]}>{t("newsLocation")}</Text>
      <TouchableOpacity
        style={[styles.trigger, { backgroundColor: surfaceColor, borderColor }]}
        onPress={() => setMenuOpen((v) => !v)}
      >
        <Text style={styles.triggerIcon}>📍</Text>
        <Text style={[styles.triggerText, { color: textColor }]} numberOfLines={1}>
          {location ? location.name : t("selectLocation")}
        </Text>
        <Text style={{ color: mutedColor }}>▼</Text>
      </TouchableOpacity>

      {menuOpen && (
        <View style={[styles.dropdown, { backgroundColor: surfaceColor, borderColor }]}>
          <LocationPickerContent
            onLocationSaved={(loc) => {
              setLocation(loc);
              bumpFeedRefresh();
              setMenuOpen(false);
            }}
            onClose={() => setMenuOpen(false)}
          />
        </View>
      )}
    </View>
  );
}

/** Modal location picker for TopBar */
export function LocationPickerModal({ visible, onClose }) {
  const { t } = useTranslation();
  const { darkMode, bumpFeedRefresh } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[styles.modalSheet, { backgroundColor: th(darkMode, dc.surface, "#fff") }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: th(darkMode, dc.text, "#0b1a2b") }]}>{t("newsLocation")}</Text>
            <TouchableOpacity onPress={onClose}><Text style={{ fontSize: 18, color: th(darkMode, dc.muted, "#64748b") }}>✕</Text></TouchableOpacity>
          </View>
          <LocationPickerContent
            onLocationSaved={() => bumpFeedRefresh()}
            onClose={onClose}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1 },
  label: { fontSize: 12, fontWeight: "600", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  trigger: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  triggerIcon: { fontSize: 16 },
  triggerText: { flex: 1, fontSize: 14, fontWeight: "600" },
  dropdown: { marginTop: 8, borderWidth: 1, borderRadius: 12, overflow: "hidden", maxHeight: 320, padding: 8 },
  detectBtn: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: "#e2e8f0" },
  detectIcon: { fontSize: 14 },
  detectText: { fontSize: 14, fontWeight: "600" },
  searchInput: { marginVertical: 8, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderRadius: 8, fontSize: 14 },
  activeHint: { marginBottom: 8, fontSize: 12, paddingHorizontal: 4 },
  results: { maxHeight: 220 },
  option: { paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#e2e8f0" },
  optionActive: { backgroundColor: "rgba(59,130,246,0.08)" },
  optionText: { fontSize: 14, fontWeight: "600" },
  optionSub: { fontSize: 11, marginTop: 2 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16, maxHeight: "75%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: "700" },
});
