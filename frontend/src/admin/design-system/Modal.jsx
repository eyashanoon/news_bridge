export function Modal({ open, onClose, children, className = "confirm-modal-card", overlayClassName = "confirm-modal-overlay" }) {
  if (!open) return null;

  return (
    <div
      className={overlayClassName}
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className={className} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
