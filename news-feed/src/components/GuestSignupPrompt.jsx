// GuestSignupPrompt.jsx — shown when a guest tries to like, dislike, or save
export default function GuestSignupPrompt({ action, onClose, onGoToLogin }) {
  return (
    <div className="guest-prompt-overlay" onClick={onClose}>
      <div className="guest-prompt-modal" onClick={(e) => e.stopPropagation()}>
        <button className="guest-prompt-close" onClick={onClose}>✕</button>
        <div className="guest-prompt-icon">🔒</div>
        <h3 className="guest-prompt-title">Sign in to {action}</h3>
        <p className="guest-prompt-text">
          Create a free account to save articles, like posts, and personalize your experience.
        </p>
        <div className="guest-prompt-actions">
          <button className="guest-prompt-btn primary" onClick={() => onGoToLogin("login")}>
            Log In
          </button>
          <button className="guest-prompt-btn secondary" onClick={() => onGoToLogin("signup")}>
            Sign Up
          </button>
          <button className="guest-prompt-btn ghost" onClick={onClose}>
            Continue Browsing
          </button>
        </div>
      </div>
    </div>
  );
}