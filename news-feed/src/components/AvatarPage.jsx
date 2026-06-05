/**
 * AI Presenter modal — embeds Avatar Studio in an iframe.
 * Opened from HomePage via LeftSidebar onOpenAvatar (see CHANGES.md).
 */
import { useEffect } from "react";
import { AvatarStudioFrame } from "./AvatarStudioFrame";

export default function AvatarPage({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="avatar-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="avatar-modal-close"
          onClick={onClose}
          aria-label="Close AI Presenter"
        >
          ✕
        </button>
        <AvatarStudioFrame
          src="/avatar-studio/public/legacy.html"
          title="AI Presenter"
          width="100%"
          height="100%"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </div>
  );
}
