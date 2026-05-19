import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import { I18nManager, Platform } from "react-native";

import en from "./en.json";
import ar from "./ar.json";

const deviceLang =
  Localization.locale?.startsWith("ar") ||
  Localization.getLocales?.()?.[0]?.languageTag?.startsWith("ar")
    ? "ar"
    : "en";

function applyDirection(lng) {
  const isRtl = lng === "ar";

  // Native RTL settings
  I18nManager.allowRTL(isRtl);
  I18nManager.forceRTL(isRtl);

  // Web: set HTML dir attribute for proper CSS-based RTL layout
  if (Platform.OS === "web" && typeof document !== "undefined") {
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    document.documentElement.style.direction = isRtl ? "rtl" : "ltr";
    document.body.style.direction = isRtl ? "rtl" : "ltr";
    document.body.style.textAlign = isRtl ? "right" : "left";
  }
}

// Apply RTL on init
applyDirection(deviceLang);

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: deviceLang,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

// Listen for language changes and toggle RTL
i18n.on("languageChanged", (lng) => {
  applyDirection(lng);
});

// Export a helper so components can check direction without relying on I18nManager.isRTL (which is cached at native level)
export function isRTL() {
  return i18n.language === "ar";
}

export default i18n;