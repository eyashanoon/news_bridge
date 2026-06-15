// languageUtils.js — Detect post/comment language and translation needs

import { franc } from "franc-min";

const ARABIC_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const HEBREW_REGEX = /[\u0590-\u05FF]/;
const CYRILLIC_REGEX = /[\u0400-\u04FF]/;
const GREEK_REGEX = /[\u0370-\u03FF]/;
const DEVANAGARI_REGEX = /[\u0900-\u097F]/;
const THAI_REGEX = /[\u0E00-\u0E7F]/;
const HIRAGANA_KATAKANA_REGEX = /[\u3040-\u30FF]/;
const HANGUL_REGEX = /[\uAC00-\uD7AF\u1100-\u11FF]/;
const CJK_REGEX = /[\u4E00-\u9FFF]/;

const FRANC_ISO3_TO_ISO2 = {
  eng: "en",
  ara: "ar",
  spa: "es",
  fra: "fr",
  deu: "de",
  ita: "it",
  heb: "he",
  rus: "ru",
  cmn: "zh",
  zho: "zh",
  por: "pt",
  tur: "tr",
  nld: "nl",
  pol: "pl",
  ukr: "uk",
  hin: "hi",
  ell: "el",
  swe: "sv",
  nor: "no",
  dan: "da",
  fin: "fi",
  ces: "cs",
  hun: "hu",
  ron: "ro",
  ind: "id",
  vie: "vi",
  tha: "th",
  jpn: "ja",
  kor: "ko",
};

const FRANC_ONLY = Object.keys(FRANC_ISO3_TO_ISO2);

const LATIN_STOPWORDS = {
  es: [" el ", " la ", " los ", " las ", " de ", " del ", " que ", " por ", " con ", " una ", " para ", " como ", " más ", " pero ", " también ", " este ", " esta ", " son ", " fue ", " han ", " sobre "],
  fr: [" le ", " la ", " les ", " des ", " une ", " est ", " dans ", " pour ", " avec ", " sur ", " pas ", " plus ", " que ", " sont ", " cette ", " comme ", " mais ", " aussi ", " ont ", " été ", " nous "],
  de: [" der ", " die ", " das ", " und ", " ist ", " nicht ", " mit ", " auf ", " für ", " auch ", " von ", " dem ", " den ", " des ", " eine ", " ein ", " als ", " nach ", " bei ", " oder ", " aber "],
  it: [" il ", " lo ", " la ", " le ", " gli ", " di ", " che ", " per ", " con ", " una ", " sono ", " del ", " della ", " anche ", " come ", " più ", " ma ", " questo ", " questa ", " stato ", " stata "],
  pt: [" o ", " a ", " os ", " as ", " de ", " do ", " da ", " que ", " para ", " com ", " uma ", " um ", " não ", " mais ", " como ", " por ", " também ", " seu ", " sua ", " são ", " foi "],
  nl: [" het ", " een ", " van ", " dat ", " die ", " voor ", " met ", " op ", " zijn ", " ook ", " naar ", " maar ", " niet ", " deze ", " dit ", " als ", " om ", " bij "],
  pl: [" że ", " się ", " nie ", " jest ", " od ", " jak ", " ale ", " po ", " za ", " czy ", " już ", " tylko ", " przez ", " jego ", " jej "],
  tr: [" ve ", " bir ", " bu ", " için ", " ile ", " olan ", " daha ", " çok ", " gibi ", " kadar ", " sonra ", " ama ", " ise ", " var ", " yok ", " olarak ", " üzerinde "],
  en: [" the ", " and ", " that ", " with ", " for ", " are ", " was ", " were ", " have ", " has ", " from ", " this ", " will ", " would ", " about ", " their ", " which ", " been ", " said ", " after "],
};

export function normalizeLang(lang) {
  if (!lang) return "";
  const l = String(lang).trim().toLowerCase();
  if (!l) return "";
  if (l.startsWith("ar")) return "ar";
  if (l.startsWith("en")) return "en";
  return l.length >= 2 ? l.slice(0, 2) : l;
}

export function isArabicText(text) {
  if (!text) return false;
  return ARABIC_REGEX.test(text);
}

function getItemContent(item, extraContent = "") {
  if (!item) return extraContent.trim();
  const parts = [item.title, item.text, item.content, extraContent];
  if (Array.isArray(item._content)) {
    for (const block of item._content) {
      if (block?.text) parts.push(block.text);
      else if (typeof block === "string") parts.push(block);
    }
  }
  return parts.filter(Boolean).join("\n").trim();
}

function detectFromScript(content) {
  if (ARABIC_REGEX.test(content)) return "ar";
  if (HEBREW_REGEX.test(content)) return "he";
  if (CYRILLIC_REGEX.test(content)) return "ru";
  if (GREEK_REGEX.test(content)) return "el";
  if (DEVANAGARI_REGEX.test(content)) return "hi";
  if (THAI_REGEX.test(content)) return "th";
  if (HANGUL_REGEX.test(content)) return "ko";
  if (HIRAGANA_KATAKANA_REGEX.test(content)) return "ja";
  if (CJK_REGEX.test(content)) return "zh";
  return "";
}

function detectFromFranc(content) {
  if (!content || content.length < 12) return "";
  const iso3 = franc(content, { minLength: 12, only: FRANC_ONLY });
  if (!iso3 || iso3 === "und") return "";
  return FRANC_ISO3_TO_ISO2[iso3] || iso3.slice(0, 2);
}

function countOccurrences(haystack, needle) {
  let count = 0;
  let idx = 0;
  while ((idx = haystack.indexOf(needle, idx)) >= 0) {
    count += 1;
    idx += needle.length;
  }
  return count;
}

function detectFromLatinStopwords(content) {
  const padded = ` ${content.toLowerCase()} `;
  let best = "";
  let bestScore = 0;
  let secondScore = 0;

  for (const [lang, words] of Object.entries(LATIN_STOPWORDS)) {
    let score = 0;
    for (const word of words) {
      score += countOccurrences(padded, word);
    }
    if (score > bestScore) {
      secondScore = bestScore;
      bestScore = score;
      best = lang;
    } else if (score > secondScore) {
      secondScore = score;
    }
  }

  if (bestScore >= 3 && bestScore >= secondScore + 2) return best;
  return "";
}

export function detectFromContent(content) {
  if (!content || !content.trim()) return "";

  const scriptLang = detectFromScript(content);
  if (scriptLang) return scriptLang;

  const francLang = detectFromFranc(content);
  if (francLang) return francLang;

  return detectFromLatinStopwords(content);
}

export function detectItemLanguage(item, extraContent = "") {
  const content = getItemContent(item, extraContent);
  const contentLang = detectFromContent(content);
  if (contentLang) return contentLang;

  const serverLang = normalizeLang(item?.detectedLang);
  const fieldLang = normalizeLang(item?.lang);

  if (serverLang && serverLang !== "en") return serverLang;
  if (fieldLang && fieldLang !== "en") return fieldLang;
  return "";
}

export function contentSampleFromBlocks(blocks) {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .map((b) => (typeof b === "string" ? b : b?.text || ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

export function needsTranslation(item, uiLang) {
  const target = normalizeLang(uiLang);
  if (!target) return false;
  const postLang = detectItemLanguage(item);
  if (!postLang) return false;
  return postLang !== target;
}

export function getTranslationTargetLang(uiLang) {
  return normalizeLang(uiLang) || "en";
}

export function getTranslateButtonLabel(uiLang, t) {
  const target = getTranslationTargetLang(uiLang);
  if (target === "ar") return t("translateToAr");
  return t("translateToEn");
}

const LANGUAGE_FALLBACK_NAMES = {
  en: "English",
  ar: "Arabic",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  he: "Hebrew",
  ru: "Russian",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
  tr: "Turkish",
  nl: "Dutch",
  pl: "Polish",
  uk: "Ukrainian",
  hi: "Hindi",
  el: "Greek",
  th: "Thai",
  sv: "Swedish",
  id: "Indonesian",
  vi: "Vietnamese",
};

export function getLanguageDisplayLabel(code, t) {
  const c = normalizeLang(code);
  if (!c) return "";
  const key = `lang_${c}`;
  if (t) {
    const translated = t(key, { defaultValue: "" });
    if (translated && translated !== key) return translated;
  }
  return LANGUAGE_FALLBACK_NAMES[c] || c.toUpperCase();
}
