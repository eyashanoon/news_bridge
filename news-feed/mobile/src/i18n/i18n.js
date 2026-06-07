// i18n.js — Internationalization config for mobile (React Native / Expo)
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { I18nManager } from "react-native";

import en from "./en.json";
import ar from "./ar.json";

const STORAGE_KEY = "newsbridge_lang";

// Get stored language preference
async function getInitialLanguage() {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  } catch (e) {
    // ignore
  }
  return "en";
}

function applyDirection(lng) {
  const isRtl = lng === "ar";
  // In React Native, we can't dynamically set the RTL after the app started
  // We'll store the preference and the user can restart
  // For now, just track it
  global.__isRTL = isRtl;
}

// Initialize
getInitialLanguage().then((lang) => {
  applyDirection(lang);
  i18n.changeLanguage(lang);
});

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: "en", // will be overridden by the async call above
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

// Listen for language changes — persist
i18n.on("languageChanged", async (lng) => {
  applyDirection(lng);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, lng);
  } catch (e) {
    // ignore
  }
});

export function isRTL() {
  return i18n.language === "ar";
}

export default i18n;