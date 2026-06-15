// i18n.js — Internationalization config for mobile (React Native / Expo)
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { I18nManager, Alert } from "react-native";

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

/**
 * Apply RTL/LTR direction for the given language.
 * NOTE: We do NOT call I18nManager.forceRTL() because it would globally flip
 * absolutely positioned elements (like the LeftSidebar) and break layout.
 * Instead, we rely on the `direction: "rtl"` style applied per-page.
 * This gives us full control over RTL behavior without the side effects.
 */
function applyDirection(lng) {
  const isRtl = lng === "ar";
  // Allow RTL (so Arabic text can render correctly) but don't force it
  // globally - that breaks our absolute positioning.
  I18nManager.allowRTL(isRtl);
  global.__isRTL = isRtl;
}

/**
 * Switch language with full RTL support.
 * When switching to/from Arabic, the app needs to restart for I18nManager to take full effect.
 */
export async function switchLanguage(newLang) {
  if (newLang === i18n.language) return;
  
  const isRtl = newLang === "ar";
  const needsRestart = I18nManager.isRTL !== isRtl;
  
  await i18n.changeLanguage(newLang);
  applyDirection(newLang);
  
  // For full RTL support, we need to restart the app
  // This is a known React Native limitation
  if (needsRestart) {
    // The language is persisted, so on next launch it will apply
    try {
      await AsyncStorage.setItem(STORAGE_KEY, newLang);
    } catch (e) {
      // ignore
    }
    // Show a brief restart notice
    Alert.alert(
      isRtl ? "تغيير الاتجاه" : "Direction Change",
      isRtl 
        ? "سيتم تطبيق التخطيط من اليمين إلى اليسار بعد إعادة تشغيل التطبيق."
        : "Left-to-right layout will apply after restarting the app.",
      [{ text: isRtl ? "حسناً" : "OK" }]
    );
  }
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
  react: {
    useSuspense: false,
  },
});

// Listen for language changes — persist
i18n.on("languageChanged", async (lng) => {
  global.__isRTL = lng === "ar";
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
