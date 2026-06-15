// GuestSignupPrompt.jsx — shown when a guest tries to like, dislike, or save
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function GuestSignupPrompt({ action, onClose, onGoToLogin }) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Translate the action to the current language
  // action comes from Post.jsx as raw English: "like or dislike posts" or "save articles"
  const actionKey = action === "like or dislike posts" ? "guestPromptLikeAction" : "guestPromptSaveAction";
  const translatedAction = t(actionKey);

  return (
    <div className="guest-prompt-overlay" onClick={onClose}>
      <div className="guest-prompt-modal" onClick={(e) => e.stopPropagation()}>
        <button className="guest-prompt-close" onClick={onClose}>✕</button>
        <div className="guest-prompt-icon">🔒</div>
        <h3 className="guest-prompt-title">{t("guestPromptSignInTitle", "Sign in to {{action}}", { action: translatedAction })}</h3>
        <p className="guest-prompt-text">{t("guestPromptText")}</p>
        <div className="guest-prompt-actions">
          <button className="guest-prompt-btn primary" onClick={() => navigate("/auth/login")}>
            {t("guestPromptLogIn", "Log In")}
          </button>
          <button className="guest-prompt-btn secondary" onClick={() => navigate("/auth/signup")}>
            {t("guestPromptSignUp", "Sign Up")}
          </button>
          <button className="guest-prompt-btn ghost" onClick={onClose}>
            {t("guestPromptContinue", "Continue Browsing")}
          </button>
        </div>
      </div>
    </div>
  );
}
