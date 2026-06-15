import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "./apiFetch";
import { getUserId } from "./userId";
import { ensureUserInitialized } from "./auth";
import { API_CONFIG } from "../api/config";

export const LOCATION_KEY = "user_location";

export const COMMON_CITIES = [
  { id: "gaza", name: "Gaza City", lat: 31.5017, lon: 34.4668 },
  { id: "khanyounis", name: "Khan Younis", lat: 31.3453, lon: 34.3091 },
  { id: "rafah", name: "Rafah", lat: 31.2919, lon: 34.2435 },
  { id: "north_gaza", name: "North Gaza", lat: 31.5667, lon: 34.5333 },
  { id: "whole_gaza", name: "All Gaza Strip", lat: 31.4167, lon: 34.4 },
];

export async function loadStoredLocation() {
  try {
    const saved = await AsyncStorage.getItem(LOCATION_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

export async function saveUserLocation(loc) {
  if (!loc) return null;
  await AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(loc));
  try {
    await ensureUserInitialized();
    const userId = await getUserId();
    await apiFetch(`${API_CONFIG.baseURL}/api/user/${userId}/location`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(loc),
    });
  } catch (e) {
    console.warn("Failed to sync location to server:", e);
  }
  return loc;
}

export async function loadUserLocationFromServer() {
  try {
    await ensureUserInitialized();
    const userId = await getUserId();
    const res = await apiFetch(`${API_CONFIG.baseURL}/api/user/${userId}/location`);
    if (!res.ok) return loadStoredLocation();
    const data = await res.json();
    if (data?.lat != null && data?.lon != null) {
      await AsyncStorage.setItem(LOCATION_KEY, JSON.stringify(data));
      return data;
    }
  } catch {
    // fall through
  }
  return loadStoredLocation();
}

export async function searchLocations(query) {
  if (!query || query.length < 2) return [];
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10`
  );
  const data = await res.json();
  return data.map((item) => ({
    id: String(item.place_id),
    name: item.display_name.split(",")[0],
    fullName: item.display_name,
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
  }));
}

export async function reverseGeocode(lat, lon) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
    );
    const data = await res.json();
    const addr = data.address || {};
    return addr.city || addr.town || addr.village || addr.county || addr.state || addr.country || "Detected Location";
  } catch {
    return "Detected Location";
  }
}
