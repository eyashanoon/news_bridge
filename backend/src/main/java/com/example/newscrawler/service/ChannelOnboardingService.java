package com.example.newscrawler.service;

import com.example.newscrawler.dto.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.util.*;

/**
 * Adaptive decision-tree questionnaire for Telegram channel onboarding.
 * Questions are generated dynamically based on prior answers.
 */
@Service
public class ChannelOnboardingService {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    /** Returns the next question given answers collected so far, or null if complete. */
    public OnboardingQuestionDto getNextQuestion(Map<String, String> answers) {
        if (answers == null || answers.isEmpty()) {
            return buildQuestion("q1_purpose", "What is the primary purpose of this channel?",
                    List.of(
                            opt("news", "News", "q2_news_scope"),
                            opt("sports", "Sports", "q2_sports_scope"),
                            opt("tech", "Tech", "q2_tech_scope"),
                            opt("finance", "Finance", "q2_finance_scope"),
                            opt("entertainment", "Entertainment", "q2_entertainment_scope"),
                            opt("other", "Other", "q2_other_desc")
                    ));
        }

        String purpose = answers.getOrDefault("q1_purpose", "").toLowerCase();

        if ("news".equals(purpose)) {
            if (!answers.containsKey("q2_news_scope")) {
                return buildQuestion("q2_news_scope", "Is this a local or international news channel?",
                        List.of(
                                opt("local", "Local", "q3_local_country"),
                                opt("international", "International", "q3_intl_region")
                        ));
            }
            if ("local".equals(answers.get("q2_news_scope"))) {
                if (!answers.containsKey("q3_local_country")) {
                    return textQuestion("q3_local_country", "Select country (e.g. Palestine, Jordan, Egypt)");
                }
                if (!answers.containsKey("q3_local_region")) {
                    return textQuestion("q3_local_region", "Select region / governorate");
                }
                if (!answers.containsKey("q3_local_city")) {
                    return textQuestion("q3_local_city", "Select city or locality");
                }
            } else {
                if (!answers.containsKey("q3_intl_region")) {
                    return buildQuestion("q3_intl_region", "Which region does this channel focus on?",
                            List.of(
                                    opt("middle_east", "Middle East", null),
                                    opt("europe", "Europe", null),
                                    opt("americas", "Americas", null),
                                    opt("asia", "Asia", null),
                                    opt("africa", "Africa", null),
                                    opt("global", "Global", null)
                            ));
                }
            }
        } else if ("sports".equals(purpose)) {
            if (!answers.containsKey("q2_sports_scope")) {
                return buildQuestion("q2_sports_scope", "What type of sports coverage?",
                        List.of(
                                opt("football", "Football", "q3_sports_league"),
                                opt("basketball", "Basketball", null),
                                opt("combat", "Combat Sports", null),
                                opt("general", "General Sports", null)
                        ));
            }
            if ("football".equals(answers.get("q2_sports_scope")) && !answers.containsKey("q3_sports_league")) {
                return textQuestion("q3_sports_league", "Primary league or team focus (optional)");
            }
        } else if ("tech".equals(purpose)) {
            if (!answers.containsKey("q2_tech_scope")) {
                return buildQuestion("q2_tech_scope", "Tech focus area?",
                        List.of(
                                opt("software", "Software & Dev", null),
                                opt("hardware", "Hardware & Gadgets", null),
                                opt("ai", "AI & ML", null),
                                opt("startups", "Startups & Business", null),
                                opt("general", "General Tech", null)
                        ));
            }
        } else if ("finance".equals(purpose)) {
            if (!answers.containsKey("q2_finance_scope")) {
                return buildQuestion("q2_finance_scope", "Finance focus?",
                        List.of(
                                opt("stocks", "Stocks & Markets", null),
                                opt("crypto", "Cryptocurrency", null),
                                opt("personal", "Personal Finance", null),
                                opt("macro", "Macro / Economy", null)
                        ));
            }
        } else if ("entertainment".equals(purpose)) {
            if (!answers.containsKey("q2_entertainment_scope")) {
                return buildQuestion("q2_entertainment_scope", "Entertainment type?",
                        List.of(
                                opt("movies", "Movies & TV", null),
                                opt("music", "Music", null),
                                opt("gaming", "Gaming", null),
                                opt("celebrity", "Celebrity & Gossip", null)
                        ));
            }
        } else if ("other".equals(purpose)) {
            if (!answers.containsKey("q2_other_desc")) {
                return textQuestion("q2_other_desc", "Briefly describe the channel niche");
            }
        }

        return null;
    }

    /** Convert questionnaire answers into structured category path and weighted intent vector. */
    public OnboardingIntentResult buildIntentFromAnswers(Map<String, String> answers) {
        List<String> path = new ArrayList<>();
        Map<String, Double> intent = new LinkedHashMap<>();

        String purpose = answers.getOrDefault("q1_purpose", "other");
        path.add(capitalize(purpose));
        intent.put(purpose, 1.0);
        intent.put("category:" + purpose, 0.9);

        switch (purpose.toLowerCase()) {
            case "news" -> {
                String scope = answers.getOrDefault("q2_news_scope", "");
                path.add(capitalize(scope));
                intent.put("news:" + scope, 0.95);
                if ("local".equals(scope)) {
                    addLocation(path, intent, answers);
                } else {
                    String region = answers.getOrDefault("q3_intl_region", "global");
                    path.add(capitalize(region.replace("_", " ")));
                    intent.put("region:" + region, 0.85);
                }
            }
            case "sports" -> {
                String scope = answers.getOrDefault("q2_sports_scope", "general");
                path.add(capitalize(scope));
                intent.put("sports:" + scope, 0.9);
                String league = answers.get("q3_sports_league");
                if (league != null && !league.isBlank()) {
                    path.add(league.trim());
                    intent.put(league.trim().toLowerCase(), 0.8);
                }
            }
            case "tech", "finance", "entertainment" -> {
                String key = "q2_" + purpose + "_scope";
                String scope = answers.getOrDefault(key, "general");
                path.add(capitalize(scope.replace("_", " ")));
                intent.put(purpose + ":" + scope, 0.9);
            }
            default -> {
                String desc = answers.getOrDefault("q2_other_desc", "");
                if (!desc.isBlank()) {
                    path.add(desc.trim());
                    for (String token : desc.toLowerCase().split("\\s+")) {
                        if (token.length() > 2) intent.put(token, 0.7);
                    }
                }
            }
        }

        return new OnboardingIntentResult(path, intent);
    }

    private void addLocation(List<String> path, Map<String, Double> intent, Map<String, String> answers) {
        String country = answers.getOrDefault("q3_local_country", "").trim();
        String region = answers.getOrDefault("q3_local_region", "").trim();
        String city = answers.getOrDefault("q3_local_city", "").trim();
        if (!country.isBlank()) {
            path.add(country);
            intent.put("country:" + country.toLowerCase(), 0.95);
            intent.put(country.toLowerCase(), 0.9);
        }
        if (!region.isBlank()) {
            path.add(region);
            intent.put("region:" + region.toLowerCase(), 0.85);
        }
        if (!city.isBlank()) {
            path.add(city);
            intent.put("city:" + city.toLowerCase(), 0.85);
            intent.put(city.toLowerCase(), 0.8);
        }
    }

    public String pathToJson(List<String> path) {
        try {
            return MAPPER.writeValueAsString(path);
        } catch (Exception e) {
            return "[]";
        }
    }

    private static OnboardingQuestionDto buildQuestion(String id, String text, List<OnboardingOptionDto> options) {
        OnboardingQuestionDto q = new OnboardingQuestionDto();
        q.id = id;
        q.text = text;
        q.type = "choice";
        q.options = options;
        return q;
    }

    private static OnboardingQuestionDto textQuestion(String id, String text) {
        OnboardingQuestionDto q = new OnboardingQuestionDto();
        q.id = id;
        q.text = text;
        q.type = "text";
        q.options = List.of();
        return q;
    }

    private static OnboardingOptionDto opt(String value, String label, String next) {
        OnboardingOptionDto o = new OnboardingOptionDto();
        o.value = value;
        o.label = label;
        o.nextQuestionId = next;
        return o;
    }

    private static String capitalize(String s) {
        if (s == null || s.isBlank()) return s;
        return s.substring(0, 1).toUpperCase() + s.substring(1).replace("_", " ");
    }

    public record OnboardingIntentResult(List<String> categoryPath, Map<String, Double> intentVector) {}
}
