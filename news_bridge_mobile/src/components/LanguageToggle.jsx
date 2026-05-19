import React, { useCallback } from "react";
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { colors } from "../theme/colors";

export default function LanguageToggle() {
  const { i18n } = useTranslation();

  const switchLang = useCallback(() => {
    const currentLang = i18n.language;
    const newLang = currentLang === "en" ? "ar" : "en";
    i18n.changeLanguage(newLang);
  }, [i18n]);

  return (
    <TouchableOpacity style={styles.btn} onPress={switchLang}>
      <Text style={styles.text}>{i18n.language === "en" ? "AR" : "EN"}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderWidth: 1,
    borderColor: "#c1d4e2",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: "#fff",
  },
  text: {
    fontWeight: "700",
    color: colors.brandStrong,
  },
});  