// In-memory cache for location so we don't keep requesting GPS
let _cachedLocation = null;

export function getCachedLocation() {
  return _cachedLocation;
}

export async function getUserLocation(forceRefresh = false) {
  // Return cached if available and not forcing refresh
  if (!forceRefresh && _cachedLocation) {
    return _cachedLocation;
  }

  try {
    // Try using expo-location if available
    let lat, lon;
    
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      // Web/Expo Go fallback
      const pos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000,
        });
      });
      lat = pos.coords.latitude;
      lon = pos.coords.longitude;
    } else {
      // expo-location for bare RN (try dynamic import)
      try {
        const Location = await import("expo-location");
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.warn("Location permission denied");
          return null;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Low,
        });
        lat = loc.coords.latitude;
        lon = loc.coords.longitude;
      } catch {
        // Neither geolocation nor expo-location available
        console.warn("Location services unavailable");
        return null;
      }
    }

    const location = { lat, lon };
    _cachedLocation = location;
    return location;
  } catch {
    return null;
  }
}