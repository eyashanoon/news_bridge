// LanguageToggle.jsx — Language switcher button for mobile
import { TouchableOpacity, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../context/ThemeContext";
import { dark as dc, th } from "../utils/darkColors";
import { switchLanguage } from "../i18n/i18n";

export default function LanguageToggle({ size = 36 }) {
  const { i18n } = useTranslation();
  const { darkMode } = useTheme();

  const handleSwitchLang = () => {
    const newLang = i18n.language === "en" ? "ar" : "en";
    switchLanguage(newLang);
  };

  return (
    <TouchableOpacity
      onPress={handleSwitchLang}
      style={[
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: th(darkMode, dc.surface, "#e2e8f0"),
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            fontSize: size * 0.4,
            color: th(darkMode, dc.text, "#0b1a2b"),
          },
        ]}
      >
        {i18n.language === "en" ? "AR" : "EN"}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontWeight: "700",
  },
});