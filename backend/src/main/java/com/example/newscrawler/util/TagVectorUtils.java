package com.example.newscrawler.util;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.*;

/**
 * Tag-vector utilities for channel semantic fusion.
 * Vectors are stored as JSON maps (tag → weight) and fused with fixed weights.
 */
public final class TagVectorUtils {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private TagVectorUtils() {}

    public static Map<String, Double> parseVector(String json) {
        if (json == null || json.isBlank()) return new HashMap<>();
        try {
            return MAPPER.readValue(json, new TypeReference<Map<String, Double>>() {});
        } catch (Exception e) {
            return new HashMap<>();
        }
    }

    public static String toJson(Map<String, Double> vector) {
        try {
            return MAPPER.writeValueAsString(vector);
        } catch (Exception e) {
            return "{}";
        }
    }

    public static Map<String, Double> mergeWeighted(
            Map<String, Double> a, double weightA,
            Map<String, Double> b, double weightB) {
        Map<String, Double> result = new HashMap<>();
        for (var e : a.entrySet()) {
            result.merge(e.getKey().toLowerCase(), e.getValue() * weightA, Double::sum);
        }
        for (var e : b.entrySet()) {
            result.merge(e.getKey().toLowerCase(), e.getValue() * weightB, Double::sum);
        }
        return result;
    }

    /**
     * Semantic fusion: 0.45 questionnaire + 0.35 post tags + 0.20 description tags.
     */
    public static Map<String, Double> fuseChannelProfile(
            Map<String, Double> questionnaire,
            Map<String, Double> postTags,
            Map<String, Double> descriptionTags) {
        Map<String, Double> fused = new HashMap<>();
        mergeInto(fused, questionnaire, 0.45);
        mergeInto(fused, postTags, 0.35);
        mergeInto(fused, descriptionTags, 0.20);
        return normalize(fused);
    }

    private static void mergeInto(Map<String, Double> target, Map<String, Double> source, double weight) {
        for (var e : source.entrySet()) {
            target.merge(e.getKey().toLowerCase(), e.getValue() * weight, Double::sum);
        }
    }

    public static Map<String, Double> normalize(Map<String, Double> vector) {
        double sum = vector.values().stream().mapToDouble(Math::abs).sum();
        if (sum <= 0) return vector;
        Map<String, Double> norm = new HashMap<>();
        for (var e : vector.entrySet()) {
            norm.put(e.getKey(), e.getValue() / sum);
        }
        return norm;
    }

    /** Cosine-like overlap between two tag vectors (dot product on normalized vectors). */
    public static double similarity(Map<String, Double> a, Map<String, Double> b) {
        Map<String, Double> na = normalize(a);
        Map<String, Double> nb = normalize(b);
        double dot = 0;
        for (var e : na.entrySet()) {
            dot += e.getValue() * nb.getOrDefault(e.getKey(), 0.0);
        }
        return dot;
    }

    /** Build a pseudo-embedding float array from sorted tag keys (for storage/compatibility). */
    public static String tagsToEmbeddingJson(Map<String, Double> tags, int dim) {
        double[] vec = new double[dim];
        int i = 0;
        for (var e : tags.entrySet()) {
            if (i >= dim) break;
            vec[i++] = e.getValue();
        }
        List<Double> list = new ArrayList<>();
        for (double v : vec) list.add(v);
        try {
            return MAPPER.writeValueAsString(list);
        } catch (Exception e) {
            return "[]";
        }
    }
}
