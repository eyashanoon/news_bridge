import { Button } from "./Button";

export function ConfirmDialog({
  open,
  title,
  message,
  requireText = false,
  expectedText = "",
  inputValue = "",
  onInputChange,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div className="confirm-modal-overlay" role="dialog" aria-modal="true">
      <div className="confirm-modal-card">
        <h3>{title}</h3>
        <p>{message}</p>
        {requireText && (
          <div className="confirm-typed-input-wrap">
            <label>Type {expectedText} to continue</label>
            <input
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              placeholder={expectedText}
            />
          </div>
        )}
        <div className="confirm-modal-actions">
          <Button size="small" onClick={onCancel}>Cancel</Button>
          <Button
            size="small"
            variant="danger"
            disabled={requireText && inputValue !== expectedText}
            onClick={onConfirm}
          >
            Confirm
          </Button>
        </div>
      </div>
    </div>
  );
}
