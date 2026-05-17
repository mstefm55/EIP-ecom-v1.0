import { useEffect, useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import "./ActionMiniModal.css";

export default function ActionMiniModal({
  open = false,
  mode = "confirm",
  title = "Confirm action",
  message = "",
  inputLabel = "Value",
  inputPlaceholder = "",
  defaultValue = "",
  required = false,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmTone = "default",
  busy = false,
  onCancel = () => {},
  onConfirm = () => {},
}) {
  const isPrompt = mode === "prompt";
  const [value, setValue] = useState(String(defaultValue || ""));

  useEffect(() => {
    if (!open) return;
    setValue(String(defaultValue || ""));
  }, [open, defaultValue]);

  useEffect(() => {
    if (!open) return undefined;
    const handleEsc = (event) => {
      if (event.key === "Escape" && !busy) {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [open, busy, onCancel]);

  if (!open) return null;

  const canConfirm =
    !busy &&
    (!isPrompt || !required || String(value || "").trim().length > 0);
  const ConfirmIcon =
    confirmTone === "danger"
      ? Trash2
      : /(create|add|new|save)/i.test(String(confirmLabel || ""))
        ? Plus
        : Check;
  const primaryClass =
    confirmTone === "danger"
      ? "action-mini-modal-btn action-mini-modal-btn-danger"
      : "action-mini-modal-btn action-mini-modal-btn-primary";

  const submit = (event) => {
    event.preventDefault();
    if (!canConfirm) return;
    if (isPrompt) {
      onConfirm(String(value || ""));
      return;
    }
    onConfirm();
  };

  return (
    <div className="action-mini-modal-overlay" role="presentation">
      <form
        className="action-mini-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={submit}
      >
        <div className="action-mini-modal-header">
          <div>
            <p className="action-mini-modal-title">{title}</p>
            {message ? (
              <p className="action-mini-modal-message">{message}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="action-mini-modal-close"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close"
          >
            <X className="action-mini-modal-close-icon" />
          </button>
        </div>

        {isPrompt ? (
          <div className="action-mini-modal-body">
            <label className="action-mini-modal-label" htmlFor="action-mini-input">
              {inputLabel}
            </label>
            <input
              id="action-mini-input"
              className="action-mini-modal-input"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={inputPlaceholder}
              autoFocus
              disabled={busy}
            />
          </div>
        ) : null}

        <div className="action-mini-modal-footer">
          <button
            type="button"
            className="action-mini-modal-btn"
            onClick={onCancel}
            disabled={busy}
          >
            <X className="action-mini-modal-btn-icon" />
            {cancelLabel}
          </button>
          <button
            type="submit"
            className={primaryClass}
            disabled={!canConfirm}
          >
            <ConfirmIcon className="action-mini-modal-btn-icon" />
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
