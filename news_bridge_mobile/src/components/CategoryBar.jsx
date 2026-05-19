import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { useTranslation } from "react-i18next";
import { colors } from "../theme/colors";

const CATEGORIES = [
  { key: "General", color: "#6b7280" },
  { key: "Politics", color: "#3b82f6" },
  { key: "Sports", color: "#f97316" },
  { key: "Finance", color: "#22c55e" },
  { key: "Medical", color: "#ef4444" },
  { key: "Tech", color: "#06b6d4" },
  { key: "Culture", color: "#a855f7" },
  { key: "Religion", color: "#d97706" },
];

export default function CategoryBar({ category, setCategory }) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {CATEGORIES.map((cat) => {
          const isActive = category === cat.key;
          return (
            <TouchableOpacity
              key={cat.key}
              onPress={() => setCategory(cat.key)}
              activeOpacity={0.7}
              style={[
                styles.chip,
                isActive && { backgroundColor: cat.color },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  isActive && { color: "#fff" },
                  !isActive && { color: colors.textSecondary },
                ]}
              >
                {t(`category_${cat.key}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(255,255,255,0.72)",
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    paddingVertical: 8,
    backdropFilter: "blur(12px)",
  },
  scroll: {
    paddingHorizontal: 14,
    gap: 6,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted,
  },
});