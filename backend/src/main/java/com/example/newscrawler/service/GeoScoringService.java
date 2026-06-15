package com.example.newscrawler.service;

import org.springframework.stereotype.Service;

import java.net.URI;
import java.util.*;
import java.util.regex.Pattern;

/**
 * Geographic relevance scoring for feed ranking.
 * Uses post tags, title/body text, and news-source URL to estimate how close
 * a story is to the user's chosen location.
 */
@Service
public class GeoScoringService {

    private record GeoPoint(String name, double lat, double lon, double confidence) {}

    private static final Map<String, GeoPoint> LOCATION_GAZETTEER = buildGazetteer();
    private static final Map<String, GeoPoint> TLD_ORIGINS = buildTldOrigins();
    private static final Map<String, GeoPoint> DOMAIN_ORIGINS = buildDomainOrigins();

    private static Map<String, GeoPoint> buildGazetteer() {
        Map<String, GeoPoint> m = new LinkedHashMap<>();
        add(m, "gaza city", "Gaza City", 31.5017, 34.4668);
        add(m, "gaza", "Gaza City", 31.5017, 34.4668);
        add(m, "khan younis", "Khan Younis", 31.3453, 34.3091);
        add(m, "rafah", "Rafah", 31.2919, 34.2435);
        add(m, "north gaza", "North Gaza", 31.5667, 34.5333);
        add(m, "gaza strip", "Gaza Strip", 31.4167, 34.4000);
        add(m, "palestine", "Palestine", 31.9522, 35.2332);
        add(m, "west bank", "West Bank", 31.9, 35.2);
        add(m, "jerusalem", "Jerusalem", 31.7683, 35.2137);
        add(m, "israel", "Israel", 31.0461, 34.8516);
        add(m, "tel aviv", "Tel Aviv", 32.0853, 34.7818);
        add(m, "egypt", "Egypt", 26.8206, 30.8025);
        add(m, "cairo", "Cairo", 30.0444, 31.2357);
        add(m, "jordan", "Jordan", 30.5852, 36.2384);
        add(m, "amman", "Amman", 31.9454, 35.9284);
        add(m, "lebanon", "Lebanon", 33.8547, 35.8623);
        add(m, "beirut", "Beirut", 33.8938, 35.5018);
        add(m, "syria", "Syria", 34.8021, 38.9968);
        add(m, "damascus", "Damascus", 33.5138, 36.2765);
        add(m, "saudi arabia", "Saudi Arabia", 23.8859, 45.0792);
        add(m, "riyadh", "Riyadh", 24.7136, 46.6753);
        add(m, "uae", "UAE", 23.4241, 53.8478);
        add(m, "dubai", "Dubai", 25.2048, 55.2708);
        add(m, "qatar", "Qatar", 25.3548, 51.1839);
        add(m, "kuwait", "Kuwait", 29.3117, 47.4818);
        add(m, "iraq", "Iraq", 33.2232, 43.6793);
        add(m, "baghdad", "Baghdad", 33.3152, 44.3661);
        add(m, "iran", "Iran", 32.4279, 53.6880);
        add(m, "tehran", "Tehran", 35.6892, 51.3890);
        add(m, "turkey", "Turkey", 38.9637, 35.2433);
        add(m, "istanbul", "Istanbul", 41.0082, 28.9784);
        add(m, "united states", "United States", 39.8283, -98.5795);
        add(m, "usa", "United States", 39.8283, -98.5795);
        add(m, "america", "United States", 39.8283, -98.5795);
        add(m, "washington", "Washington DC", 38.9072, -77.0369);
        add(m, "new york", "New York", 40.7128, -74.0060);
        add(m, "california", "California", 36.7783, -119.4179);
        add(m, "united kingdom", "United Kingdom", 55.3781, -3.4360);
        add(m, "britain", "United Kingdom", 55.3781, -3.4360);
        add(m, "london", "London", 51.5074, -0.1278);
        add(m, "france", "France", 46.2276, 2.2137);
        add(m, "paris", "Paris", 48.8566, 2.3522);
        add(m, "germany", "Germany", 51.1657, 10.4515);
        add(m, "berlin", "Berlin", 52.5200, 13.4050);
        add(m, "spain", "Spain", 40.4637, -3.7492);
        add(m, "madrid", "Madrid", 40.4168, -3.7038);
        add(m, "barcelona", "Barcelona", 41.3874, 2.1686);
        add(m, "italy", "Italy", 41.8719, 12.5674);
        add(m, "rome", "Rome", 41.9028, 12.4964);
        add(m, "china", "China", 35.8617, 104.1954);
        add(m, "beijing", "Beijing", 39.9042, 116.4074);
        add(m, "india", "India", 20.5937, 78.9629);
        add(m, "russia", "Russia", 61.5240, 105.3188);
        add(m, "ukraine", "Ukraine", 48.3794, 31.1656);
        add(m, "europe", "Europe", 50.0, 10.0);
        add(m, "africa", "Africa", 8.7832, 34.5085);
        add(m, "asia", "Asia", 34.0479, 100.6197);
        return m;
    }

    private static void add(Map<String, GeoPoint> m, String key, String name, double lat, double lon) {
        m.put(key, new GeoPoint(name, lat, lon, 0.85));
    }

    private static Map<String, GeoPoint> buildTldOrigins() {
        Map<String, GeoPoint> m = new HashMap<>();
        m.put("us", new GeoPoint("United States", 39.8283, -98.5795, 0.7));
        m.put("uk", new GeoPoint("United Kingdom", 55.3781, -3.4360, 0.7));
        m.put("co.uk", new GeoPoint("United Kingdom", 55.3781, -3.4360, 0.75));
        m.put("es", new GeoPoint("Spain", 40.4637, -3.7492, 0.7));
        m.put("fr", new GeoPoint("France", 46.2276, 2.2137, 0.7));
        m.put("de", new GeoPoint("Germany", 51.1657, 10.4515, 0.7));
        m.put("it", new GeoPoint("Italy", 41.8719, 12.5674, 0.7));
        m.put("eg", new GeoPoint("Egypt", 26.8206, 30.8025, 0.7));
        m.put("sa", new GeoPoint("Saudi Arabia", 23.8859, 45.0792, 0.7));
        m.put("ae", new GeoPoint("UAE", 23.4241, 53.8478, 0.7));
        m.put("jo", new GeoPoint("Jordan", 30.5852, 36.2384, 0.7));
        m.put("lb", new GeoPoint("Lebanon", 33.8547, 35.8623, 0.7));
        m.put("ps", new GeoPoint("Palestine", 31.9522, 35.2332, 0.75));
        m.put("il", new GeoPoint("Israel", 31.0461, 34.8516, 0.7));
        m.put("tr", new GeoPoint("Turkey", 38.9637, 35.2433, 0.7));
        m.put("ru", new GeoPoint("Russia", 61.5240, 105.3188, 0.7));
        m.put("cn", new GeoPoint("China", 35.8617, 104.1954, 0.7));
        m.put("in", new GeoPoint("India", 20.5937, 78.9629, 0.7));
        m.put("au", new GeoPoint("Australia", -25.2744, 133.7751, 0.7));
        m.put("ca", new GeoPoint("Canada", 56.1304, -106.3468, 0.7));
        return m;
    }

    private static Map<String, GeoPoint> buildDomainOrigins() {
        Map<String, GeoPoint> m = new HashMap<>();
        m.put("cnn.com", new GeoPoint("United States", 39.8283, -98.5795, 0.8));
        m.put("nytimes.com", new GeoPoint("United States", 39.8283, -98.5795, 0.8));
        m.put("washingtonpost.com", new GeoPoint("United States", 39.8283, -98.5795, 0.8));
        m.put("foxnews.com", new GeoPoint("United States", 39.8283, -98.5795, 0.8));
        m.put("bbc.com", new GeoPoint("United Kingdom", 55.3781, -3.4360, 0.8));
        m.put("bbc.co.uk", new GeoPoint("United Kingdom", 55.3781, -3.4360, 0.85));
        m.put("theguardian.com", new GeoPoint("United Kingdom", 55.3781, -3.4360, 0.8));
        m.put("elpais.com", new GeoPoint("Spain", 40.4637, -3.7492, 0.85));
        m.put("marca.com", new GeoPoint("Spain", 40.4637, -3.7492, 0.85));
        m.put("aljazeera.com", new GeoPoint("Qatar", 25.3548, 51.1839, 0.8));
        m.put("aljazeera.net", new GeoPoint("Qatar", 25.3548, 51.1839, 0.8));
        m.put("haaretz.com", new GeoPoint("Israel", 31.0461, 34.8516, 0.8));
        m.put("timesofisrael.com", new GeoPoint("Israel", 31.0461, 34.8516, 0.8));
        m.put("middleeasteye.net", new GeoPoint("Middle East", 31.0, 35.0, 0.75));
        m.put("reuters.com", new GeoPoint("International", 51.5074, -0.1278, 0.5));
        m.put("apnews.com", new GeoPoint("United States", 39.8283, -98.5795, 0.75));
        return m;
    }

    public boolean hasUserLocation(Double lat, Double lon) {
        return lat != null && lon != null && !(lat == 0.0 && lon == 0.0);
    }

    /**
     * Returns a normalized geo relevance score in [0, 1].
     */
    public double computeGeoScore(Double userLat, Double userLon, String feedCategory,
                                  List<String> tags, String articleUrl, String title, String text) {
        if (!hasUserLocation(userLat, userLon)) {
            return 0.5;
        }

        List<GeoPoint> locations = extractLocations(tags, title, text);
        GeoPoint source = inferSourceOrigin(articleUrl);
        if (source != null) {
            locations.add(source);
        }

        double multiplier = calculateGeoMultiplier(userLat, userLon, locations, feedCategory);
        return Math.min(1.0, multiplier / 10.0);
    }

    private List<GeoPoint> extractLocations(List<String> tags, String title, String text) {
        Set<String> seen = new HashSet<>();
        List<GeoPoint> found = new ArrayList<>();
        String combined = buildSearchText(tags, title, text);

        for (Map.Entry<String, GeoPoint> entry : LOCATION_GAZETTEER.entrySet()) {
            if (containsTerm(combined, entry.getKey()) && seen.add(entry.getValue().name)) {
                double confidence = title != null && containsTerm(title.toLowerCase(), entry.getKey()) ? 0.95 : 0.8;
                GeoPoint base = entry.getValue();
                found.add(new GeoPoint(base.name, base.lat, base.lon, confidence));
            }
        }
        return found;
    }

    private String buildSearchText(List<String> tags, String title, String text) {
        StringBuilder sb = new StringBuilder();
        if (tags != null) {
            for (String tag : tags) {
                if (tag != null) sb.append(tag.toLowerCase()).append(' ');
            }
        }
        if (title != null) sb.append(title.toLowerCase()).append(' ');
        if (text != null) sb.append(text.toLowerCase());
        return sb.toString();
    }

    private boolean containsTerm(String haystack, String term) {
        if (haystack == null || term == null || term.isBlank()) return false;
        if (term.contains(" ")) {
            return haystack.contains(term);
        }
        return Pattern.compile("\\b" + Pattern.quote(term) + "\\b").matcher(haystack).find();
    }

    private GeoPoint inferSourceOrigin(String articleUrl) {
        if (articleUrl == null || articleUrl.isBlank()) return null;
        try {
            String host = URI.create(articleUrl).getHost();
            if (host == null) return null;
            host = host.toLowerCase();
            if (host.startsWith("www.")) host = host.substring(4);

            for (Map.Entry<String, GeoPoint> e : DOMAIN_ORIGINS.entrySet()) {
                if (host.equals(e.getKey()) || host.endsWith("." + e.getKey())) {
                    return e.getValue();
                }
            }

            for (Map.Entry<String, GeoPoint> e : TLD_ORIGINS.entrySet()) {
                if (host.endsWith("." + e.getKey())) {
                    return e.getValue();
                }
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private double calculateGeoMultiplier(double userLat, double userLon,
                                          List<GeoPoint> locations, String category) {
        boolean sports = category != null && category.equalsIgnoreCase("sports");

        if (locations.isEmpty()) {
            return sports ? 2.2 : 1.0;
        }

        double minDistance = Double.MAX_VALUE;
        double bestConfidence = 0.0;
        for (GeoPoint loc : locations) {
            double distance = haversineKm(userLat, userLon, loc.lat, loc.lon);
            if (distance < minDistance) {
                minDistance = distance;
                bestConfidence = loc.confidence;
            }
        }

        if (sports) {
            if (minDistance < 50) return 0.4;
            if (minDistance < 500) return 0.8;
            if (minDistance < 2000) return 1.5;
            return 2.2;
        }

        double base;
        if (minDistance < 15) base = 10.0;
        else if (minDistance < 50) base = 7.0;
        else if (minDistance < 150) base = 5.0;
        else if (minDistance < 500) base = 3.0;
        else if (minDistance < 1500) base = 1.5;
        else base = 1.0;

        return base * Math.max(0.3, bestConfidence);
    }

    private double haversineKm(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return 6371.0 * c;
    }
}
