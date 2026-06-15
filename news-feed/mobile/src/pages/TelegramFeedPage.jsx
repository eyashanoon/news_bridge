import { View, StyleSheet } from "react-native";
import TopBar from "../components/TopBar";
import TelegramFeed from "../components/TelegramFeed";
import { useTheme } from "../context/ThemeContext";
import { categoryTheme } from "../utils/categoryColors";
import { dark as dc, th } from "../utils/darkColors";
import { useTranslation } from "react-i18next";

export default function TelegramFeedPage({ navigation }) {
  const { currentCategory, darkMode } = useTheme();
  const { i18n } = useTranslation();
  const theme = categoryTheme[currentCategory]?.light || categoryTheme.General.light;
  const isRtl = i18n.language === "ar";

  return (
    <View style={[styles.container, { backgroundColor: th(darkMode, dc.bg, theme.bg), direction: isRtl ? "rtl" : "ltr" }]}>
      <TopBar navigation={navigation} />
      <TelegramFeed />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
