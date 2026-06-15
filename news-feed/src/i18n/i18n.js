// i18n.js — Internationalization config for news-feed (web)
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./en.json";
import ar from "./ar.json";

// Get stored language preference or browser default
function getInitialLanguage() {
  const stored = localStorage.getItem("newsbridge_lang");
  if (stored) return stored;
  const navLang = navigator.language || navigator.languages?.[0] || "en";
  return navLang.startsWith("ar") ? "ar" : "en";
}

function applyDirection(lng) {
  const isRtl = lng === "ar";
  document.documentElement.dir = isRtl ? "rtl" : "ltr";
  document.documentElement.style.direction = isRtl ? "rtl" : "ltr";
  document.body.style.direction = isRtl ? "rtl" : "ltr";
  document.body.style.textAlign = isRtl ? "right" : "left";
}

const initialLang = getInitialLanguage();
applyDirection(initialLang);

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: initialLang,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

// Listen for language changes — toggle RTL and persist
i18n.on("languageChanged", (lng) => {
  applyDirection(lng);
  localStorage.setItem("newsbridge_lang", lng);
  // Force re-render by triggering a custom event
  window.dispatchEvent(new CustomEvent("languageChanged", { detail: lng }));
});

export function isRTL() {
  return i18n.language === "ar";
}

export default i18n;