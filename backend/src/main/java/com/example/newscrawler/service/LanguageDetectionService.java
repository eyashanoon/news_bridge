package com.example.newscrawler.service;

import com.google.common.base.Optional;
import com.optimaize.langdetect.DetectedLanguage;
import com.optimaize.langdetect.LanguageDetector;
import com.optimaize.langdetect.LanguageDetectorBuilder;
import com.optimaize.langdetect.ngram.NgramExtractors;
import com.optimaize.langdetect.profiles.LanguageProfile;
import com.optimaize.langdetect.profiles.LanguageProfileReader;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Content-language detection for feed ranking and translation UI hints.
 * Analyzes title, post text, and article paragraphs — never guesses English by default.
 */
@Service
public class LanguageDetectionService {

    private static final Logger log = LoggerFactory.getLogger(LanguageDetectionService.class);

    private static final Pattern ARABIC = Pattern.compile(
            "[\\u0600-\\u06FF\\u0750-\\u077F\\u08A0-\\u08FF\\uFB50-\\uFDFF\\uFE70-\\uFEFF]");
    private static final Pattern HEBREW = Pattern.compile("[\\u0590-\\u05FF]");
    private static final Pattern CYRILLIC = Pattern.compile("[\\u0400-\\u04FF]");
    private static final Pattern GREEK = Pattern.compile("[\\u0370-\\u03FF]");
    private static final Pattern DEVANAGARI = Pattern.compile("[\\u0900-\\u097F]");
    private static final Pattern THAI = Pattern.compile("[\\u0E00-\\u0E7F]");
    private static final Pattern HIRAGANA_KATAKANA = Pattern.compile("[\\u3040-\\u30FF]");
    private static final Pattern HANGUL = Pattern.compile("[\\uAC00-\\uD7AF\\u1100-\\u11FF]");
    private static final Pattern CJK = Pattern.compile("[\\u4E00-\\u9FFF]");

    private static final List<String> LATIN_STOPWORD_LANGS =
            List.of("es", "fr", "de", "it", "pt", "nl", "pl", "tr", "en");

    private static final Map<String, String[]> LATIN_STOPWORDS = Map.ofEntries(
            Map.entry("es", new String[]{" el ", " la ", " los ", " las ", " del ", " que ", " por ", " con ", " una ", " para ", " como ", " más ", " pero ", " también ", " este ", " esta ", " son ", " fueron ", " sobre ", " entre "}),
            Map.entry("fr", new String[]{" le ", " la ", " les ", " des ", " une ", " est ", " dans ", " pour ", " avec ", " sur ", " pas ", " plus ", " que ", " sont ", " cette ", " comme ", " mais ", " aussi ", " ont ", " été ", " nous "}),
            Map.entry("de", new String[]{" der ", " die ", " das ", " und ", " ist ", " nicht ", " mit ", " auf ", " für ", " auch ", " von ", " dem ", " den ", " des ", " eine ", " ein ", " als ", " nach ", " bei ", " oder ", " aber "}),
            Map.entry("it", new String[]{" il ", " lo ", " la ", " le ", " gli ", " che ", " per ", " con ", " una ", " sono ", " del ", " della ", " anche ", " come ", " più ", " ma ", " questo ", " questa ", " stato ", " stata "}),
            Map.entry("pt", new String[]{" o ", " a ", " os ", " as ", " do ", " da ", " que ", " para ", " com ", " uma ", " um ", " não ", " mais ", " como ", " por ", " também ", " seu ", " sua ", " são ", " foi "}),
            Map.entry("nl", new String[]{" het ", " een ", " van ", " dat ", " die ", " voor ", " met ", " op ", " zijn ", " ook ", " naar ", " maar ", " niet ", " deze ", " dit ", " als ", " bij "}),
            Map.entry("pl", new String[]{" że ", " się ", " nie ", " jest ", " od ", " jak ", " ale ", " po ", " za ", " czy ", " już ", " tylko ", " przez ", " jego ", " jej "}),
            Map.entry("tr", new String[]{" ve ", " bir ", " bu ", " için ", " ile ", " olan ", " daha ", " çok ", " gibi ", " kadar ", " sonra ", " ama ", " ise ", " var ", " yok ", " olarak ", " üzerinde "}),
            Map.entry("en", new String[]{" the ", " and ", " that ", " with ", " for ", " are ", " was ", " were ", " have ", " has ", " from ", " this ", " will ", " would ", " about ", " their ", " which ", " been ", " said ", " after "})
    );

    private LanguageDetector ngramDetector;
    private List<LanguageProfile> languageProfiles;

    @PostConstruct
    void initDetector() {
        try {
            languageProfiles = new LanguageProfileReader().readAllBuiltIn();
            ngramDetector = LanguageDetectorBuilder.create(NgramExtractors.standard())
                    .withProfiles(languageProfiles)
                    .build();
        } catch (IOException e) {
            log.warn("Failed to load language profiles; falling back to script/stopword heuristics", e);
            ngramDetector = null;
            languageProfiles = List.of();
        }
    }

    public String detectLanguage(String storedLang, String title, String postText) {
        return detectLanguage(storedLang, title, postText, null);
    }

    /**
     * Detect language from stored metadata cross-checked against title, post body, and article paragraphs.
     */
    public String detectLanguage(String storedLang, String title, String postText, String articleText) {
        String sample = buildSample(title, postText, articleText);
        String fieldLang = normalizeLangCode(storedLang);

        if (sample.isBlank()) {
            return isGenericDefault(fieldLang) ? "" : fieldLang;
        }

        String contentLang = detectFromContent(sample);
        if (!contentLang.isEmpty()) {
            return contentLang;
        }

        if (!isGenericDefault(fieldLang)) {
            return fieldLang;
        }
        return "";
    }

    private String detectFromContent(String sample) {
        String scriptLang = detectFromScript(sample);
        if (!scriptLang.isEmpty()) {
            return scriptLang;
        }

        String ngramLang = detectFromNgrams(sample);
        if (!ngramLang.isEmpty()) {
            return ngramLang;
        }

        return detectFromLatinStopwords(sample);
    }

    private String detectFromScript(String sample) {
        if (ARABIC.matcher(sample).find()) return "ar";
        if (HEBREW.matcher(sample).find()) return "he";
        if (CYRILLIC.matcher(sample).find()) return "ru";
        if (GREEK.matcher(sample).find()) return "el";
        if (DEVANAGARI.matcher(sample).find()) return "hi";
        if (THAI.matcher(sample).find()) return "th";
        if (HANGUL.matcher(sample).find()) return "ko";
        if (HIRAGANA_KATAKANA.matcher(sample).find()) return "ja";
        if (CJK.matcher(sample).find()) return "zh";
        return "";
    }

    private String detectFromNgrams(String sample) {
        if (ngramDetector == null || sample.length() < 15) {
            return "";
        }

        List<DetectedLanguage> probabilities = ngramDetector.getProbabilities(sample);
        if (probabilities.isEmpty()) {
            return "";
        }

        DetectedLanguage top = probabilities.get(0);
        double topProb = top.getProbability();
        String topLang = normalizeLangCode(top.getLocale().getLanguage());

        if (topProb >= 0.45) {
            return topLang;
        }

        if (probabilities.size() >= 2) {
            double secondProb = probabilities.get(1).getProbability();
            if (topProb >= 0.18 && topProb >= secondProb * 1.75) {
                return topLang;
            }
        } else if (sample.length() >= 60 && topProb >= 0.22) {
            return topLang;
        }

        return "";
    }

    private String detectFromLatinStopwords(String sample) {
        String padded = " " + sample.toLowerCase() + " ";
        Map<String, Integer> scores = new LinkedHashMap<>();

        for (String lang : LATIN_STOPWORD_LANGS) {
            String[] words = LATIN_STOPWORDS.get(lang);
            if (words == null) continue;
            int score = 0;
            for (String word : words) {
                int idx = 0;
                while ((idx = padded.indexOf(word, idx)) >= 0) {
                    score++;
                    idx += word.length();
                }
            }
            if (score > 0) {
                scores.put(lang, score);
            }
        }

        if (scores.isEmpty()) {
            return "";
        }

        String best = "";
        int bestScore = 0;
        int secondScore = 0;
        for (Map.Entry<String, Integer> entry : scores.entrySet()) {
            if (entry.getValue() > bestScore) {
                secondScore = bestScore;
                bestScore = entry.getValue();
                best = entry.getKey();
            } else if (entry.getValue() > secondScore) {
                secondScore = entry.getValue();
            }
        }

        if (bestScore >= 3 && bestScore >= secondScore + 2) {
            return best;
        }
        return "";
    }

    private boolean isGenericDefault(String lang) {
        return "en".equals(lang) || "ar".equals(lang);
    }

    public String normalizeLangCode(String lang) {
        if (lang == null || lang.isBlank()) return "";
        String l = lang.trim().toLowerCase();
        if (l.startsWith("ar")) return "ar";
        if (l.startsWith("en")) return "en";
        if (l.length() >= 2) return l.substring(0, 2);
        return l;
    }

    public boolean languagesMatch(String a, String b) {
        String na = normalizeLangCode(a);
        String nb = normalizeLangCode(b);
        if (na.isEmpty() || nb.isEmpty()) return false;
        return na.equals(nb);
    }

    private String buildSample(String title, String postText, String articleText) {
        StringBuilder sb = new StringBuilder();
        LinkedHashSet<String> parts = new LinkedHashSet<>();

        if (title != null && !title.isBlank()) {
            parts.add(title.trim());
        }
        if (postText != null && !postText.isBlank()) {
            parts.add(postText.trim());
        }
        if (articleText != null && !articleText.isBlank()) {
            parts.add(articleText.trim());
        }

        int budget = 5000;
        for (String part : parts) {
            if (budget <= 0) break;
            String chunk = part.length() > budget ? part.substring(0, budget) : part;
            if (!sb.isEmpty()) sb.append("\n\n");
            sb.append(chunk);
            budget -= chunk.length();
        }
        return sb.toString().trim();
    }
}
