// CategoryBar.jsx
import { categories } from "../utils/categoryConfig";
import { categoryTheme } from "../utils/categoryColors";
import { useTheme } from "../context/ThemeContext";
import { useTranslation } from "react-i18next";

export default function CategoryBar({ category, setCategory }) {
  const { darkMode } = useTheme();
  const { t } = useTranslation();
  const mode = darkMode ? "dark" : "light";

  return (
    <div className="category-bar">
      {categories.map((cat) => {
        const theme = categoryTheme[cat.name]?.[mode] || categoryTheme.General[mode];
        const isActive = category === cat.name;

        return (
          <button
            key={cat.name}
            onClick={() => setCategory(cat.name)}
            className="category-pill"
            style={
              isActive
                ? {
                    background: theme.pillBg,
                    color: theme.pillText,
                    boxShadow: `0 2px 8px ${theme.glow}`,
                    fontWeight: 700,
                  }
                : {}
            }
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = theme.accentLight;
                e.currentTarget.style.color = theme.accent;
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "";
              }
            }}
          >
            {t(`category_${cat.name}`, cat.name)}
          </button>
        );
      })}
    </div>
  );
}
