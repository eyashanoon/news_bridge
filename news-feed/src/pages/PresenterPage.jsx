/**
 * PresenterPage — dedicated full-page AI News Presenter.
 * No modal/overlay, just the avatar studio taking the full viewport.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AvatarStudioFrame } from "../components/AvatarStudioFrame";

export default function PresenterPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") navigate("/news");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navigate]);

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
      background: "#000",
    }}>
      <button
        onClick={() => navigate("/news")}
        style={{
          position: "absolute",
          top: "1rem",
          right: "1rem",
          zIndex: 10000,
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.3)",
          color: "#fff",
          borderRadius: "0.5rem",
          padding: "0.5rem 1rem",
          cursor: "pointer",
          fontSize: "0.9rem",
          fontWeight: 600,
          backdropFilter: "blur(8px)",
        }}
      >
        ✕ Back to News
      </button>
      <AvatarStudioFrame
        src="/avatar-studio/public/legacy.html"
        title="AI Presenter"
        width="100%"
        height="100%"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </div>
  );
}