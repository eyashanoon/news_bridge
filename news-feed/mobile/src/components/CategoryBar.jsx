import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from "react-native";
import { categoryTheme } from "../utils/categoryColors";
import { useTheme } from "../context/ThemeContext";
import { dark as dc, th } from "../utils/darkColors";
import { useTranslation } from "react-i18next";

const CATEGORIES = ["General", "Politics", "Sports", "Finance", "Medical", "Tech", "Culture", "Religion"];

export default function CategoryBar({ category, setCategory }) {
  const { darkMode } = useTheme();
  const { t } = useTranslation();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.container, { borderBottomColor: th(darkMode, dc.border, "#e2e8f0") }]} contentContainerStyle={styles.content}>
      {CATEGORIES.map((cat) => {
        const theme = categoryTheme[cat]?.light || categoryTheme.General.light;
        const isActive = category === cat;
        return (
          <TouchableOpacity
            key={cat}
            onPress={() => setCategory(cat)}
            style={[
              styles.pill,
              { backgroundColor: isActive ? theme.pillBg : "transparent", borderColor: theme.pillBg },
            ]}
          >
            <Text style={[styles.pillText, { color: isActive ? theme.pillText : theme.pillBg }]}>
              {t(`category_${cat}`)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 40,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  content: { paddingHorizontal: 16, gap: 6, alignItems: "center", minHeight: 50, paddingBottom: 8 },
  pill: {
    flexShrink: 0,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 9999,
    borderWidth: 1.5,
  },
  pillText: { fontSize: 13, fontWeight: "600" },
});
