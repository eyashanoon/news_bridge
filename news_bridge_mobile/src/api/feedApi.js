import { apiClient } from "./apiClient";
import { getUserId, ensureUserInitialized } from "./auth";
import { getUserLocation, getCachedLocation } from "./location";
import storage from "../utils/storage";

export async function fetchFeedPosts({ category = "General", page = 0, limit = 10 } = {}) {
  // Ensure user is initialized first (gets JWT token)
  await ensureUserInitialized();
  const userId = getUserId() || "mobile-user";

  let url = `/api/feed?userId=${userId}&category=${category}&limit=${limit}&page=${page}`;

  // Include user location if available (for location-prioritized feed)
  // Priority: 1) localStorage (manually set by user in side menu), 2) GPS cache, 3) GPS live
  // This matches the web version's approach in Feed.jsx which reads localStorage('user_location')
  let lat, lon;
  const savedLoc = storage.getJSON("user_location");
  if (savedLoc && savedLoc.lat && savedLoc.lon) {
    lat = savedLoc.lat;
    lon = savedLoc.lon;
  }

  if (!lat || !lon) {
    let location = getCachedLocation();
    if (!location) {
      try {
        location = await getUserLocation();
      } catch {
        // proceed without location
      }
    }
    if (location && location.lat && location.lon) {
      lat = location.lat;
      lon = location.lon;
    }
  }

  if (lat && lon) {
    url += `&lat=${lat}&lon=${lon}`;
  }

  const res = await apiClient.get(url);
  return res.data;
}
