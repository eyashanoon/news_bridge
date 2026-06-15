// LanguageToggle.jsx — Language switcher button for the header
import { useTranslation } from "react-i18next";

export default function LanguageToggle() {
  const { i18n } = useTranslation();

  const switchLang = () => {
    const newLang = i18n.language === "en" ? "ar" : "en";
    i18n.changeLanguage(newLang);
  };

  return (
    <button
      onClick={switchLang}
      className="language-toggle-btn"
      title={i18n.language === "en" ? "العربية" : "English"}
    >
      {i18n.language === "en" ? "AR" : "EN"}
    </button>
  );
}