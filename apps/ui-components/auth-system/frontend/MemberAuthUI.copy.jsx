import { useEffect, useMemo, useRef, useState } from "react";
import "flag-icons/css/flag-icons.min.css";
import "./MemberAuthUI.copy.css";

function resolveCopy(t, key, fallback) {
  if (typeof t !== "function") return fallback;
  const value = t(key);
  if (value === undefined || value === null || value === "" || value === key) return fallback;
  return value;
}

function normalizeIso(isoCode) {
  return String(isoCode || "").trim().toUpperCase();
}

function isValidIso(isoCode) {
  const iso = normalizeIso(isoCode);
  return /^[A-Z]{2}$/.test(iso);
}

const FALLBACK_COUNTRY_OPTIONS = [
  { iso: "AE", name: "United Arab Emirates", dial: "+971" },
  { iso: "FR", name: "France", dial: "+33" },
  { iso: "MU", name: "Mauritius", dial: "+230" },
  { iso: "GB", name: "United Kingdom", dial: "+44" },
  { iso: "US", name: "United States", dial: "+1" },
];

export const DEFAULT_COUNTRY_OPTIONS = FALLBACK_COUNTRY_OPTIONS.map((item) => ({
  ...item,
  iso: normalizeIso(item.iso),
}));

function sanitizeLocalPhoneDigits(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 15);
}

function UiIcon({ name, className = "authui-icon" }) {
  const paths = {
    chevronDown: "m6 9 6 6 6-6",
    close: "M6 6l12 12M18 6 6 18",
    send: "M3 11.5 21 3l-6.6 18-2.9-7.4L3 11.5zM11.5 13.6 21 3",
    eye: "M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    eyeOff:
      "M3 3l18 18M9.9 4.6A11.2 11.2 0 0 1 12 4c6.5 0 10 8 10 8a19.6 19.6 0 0 1-4.4 5.5M14.1 14.1a3 3 0 0 1-4.2-4.2M6.5 6.5A20 20 0 0 0 2 12s3.5 8 10 8c1 0 2-.2 3-.5",
    userPlus: "M12 13.6a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm-8 7.4a8 8 0 0 1 12.8-6.2M20 9v6M17 12h6",
  };
  const d = paths[name];
  if (!d) return null;
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path d={d} />
    </svg>
  );
}

export function FlagMark({ iso }) {
  if (!isValidIso(iso)) return null;
  const code = normalizeIso(iso).toLowerCase();
  return <span className={`fi fi-${code} authui-flag-mark`} aria-hidden="true" />;
}

export function AuthModalShell({ open, onClose, children, panelClassName = "" }) {
  if (!open) return null;
  return (
    <div className="authui-backdrop" onClick={onClose}>
      <div
        className={`authui-panel ${panelClassName}`.trim()}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
}

export function MemberEntryModal({ open, onClose, onSignIn, onSignUp, t }) {
  return (
    <AuthModalShell open={open} onClose={onClose} panelClassName="authui-choice-panel">
      <div className="authui-header">
        <h3>{resolveCopy(t, "auth.entryTitle", "Welcome back")}</h3>
        <p>{resolveCopy(t, "auth.entrySubtitle", "Continue with your member account or create one.")}</p>
      </div>
      <div className="authui-choice-list">
        <button type="button" className="authui-choice-btn" onClick={onSignIn}>
          <strong>{resolveCopy(t, "auth.entryHasAccount", "Already have an account?")}</strong>
          <span>{resolveCopy(t, "auth.entrySignIn", "Sign in")}</span>
        </button>
        <button type="button" className="authui-choice-btn" onClick={onSignUp}>
          <strong>{resolveCopy(t, "auth.entryNoAccount", "Not yet a member?")}</strong>
          <span>{resolveCopy(t, "auth.entrySignUp", "Sign up")}</span>
        </button>
      </div>
      <div className="authui-actions">
        <button type="button" className="authui-btn authui-btn-ghost" onClick={onClose}>
          {resolveCopy(t, "auth.close", "Close")}
        </button>
      </div>
    </AuthModalShell>
  );
}

function useDismissOnOutsideClick(open, rootRef, onDismiss) {
  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target)) return;
      onDismiss();
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [open, onDismiss, rootRef]);
}

function PhoneCodeSelect({ value, options, onChange }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((item) => item.iso === value) || options[0];
  const selectedDial = selected?.dial || "--";

  useDismissOnOutsideClick(open, rootRef, () => setOpen(false));

  if (!selected) return null;

  return (
    <div className={`authui-picker authui-phone-picker ${open ? "open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="authui-picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="authui-flag-text">
          <FlagMark iso={selected.iso} />
          <span>{selectedDial}</span>
        </span>
        <UiIcon name="chevronDown" />
      </button>
      {open ? (
        <div className="authui-picker-menu authui-phone-menu" role="listbox" aria-label="Phone country code">
          {options.map((item) => (
            <button
              key={item.iso}
              type="button"
              className={`authui-picker-option ${item.iso === selected.iso ? "active" : ""}`}
              onClick={() => {
                onChange(item.iso);
                setOpen(false);
              }}
            >
              <span className="authui-picker-option-main authui-flag-text">
                <FlagMark iso={item.iso} />
                <span>{item.name}</span>
              </span>
              <span className="authui-picker-option-meta">{`${item.iso} ${item.dial || "--"}`}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CountrySelect({ value, options, onChange }) {
  const rootRef = useRef(null);
  const [open, setOpen] = useState(false);
  const selected = options.find((item) => item.iso === value) || options[0];

  useDismissOnOutsideClick(open, rootRef, () => setOpen(false));

  if (!selected) return null;

  return (
    <div className={`authui-picker ${open ? "open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="authui-picker-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="authui-flag-text">
          <FlagMark iso={selected.iso} />
          <span>{selected.name}</span>
        </span>
        <UiIcon name="chevronDown" />
      </button>
      {open ? (
        <div className="authui-picker-menu" role="listbox" aria-label="Country">
          {options.map((item) => (
            <button
              key={item.iso}
              type="button"
              className={`authui-picker-option ${item.iso === selected.iso ? "active" : ""}`}
              onClick={() => {
                onChange(item.iso);
                setOpen(false);
              }}
            >
              <span className="authui-flag-text">
                <FlagMark iso={item.iso} />
                <span>{item.name}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function MemberAuthModal({
  open,
  onClose,
  form = {},
  onChange,
  onSubmit,
  status = null,
  t,
  termsText = "",
  termsItems = [],
  termsLoading = false,
  countryOptions = DEFAULT_COUNTRY_OPTIONS,
  visualImageUrl = "",
}) {
  const mode = form.mode === "signup" ? "signup" : "signin";
  const isSignUp = mode === "signup";
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const termLinks = useMemo(
    () =>
      Array.isArray(termsItems)
        ? termsItems
            .map((item, index) => ({
              url: String(item?.url || "").trim(),
              label: String(item?.label || item?.code || `Condition ${index + 1}`).trim(),
            }))
            .filter((item) => item.url)
        : [],
    [termsItems]
  );

  useEffect(() => {
    if (!open) {
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  }, [open]);

  const mutateField = (field, value) => {
    if (typeof onChange === "function") onChange(field, value);
  };

  const submitHandler = (event) => {
    if (typeof onSubmit === "function") onSubmit(event, mode);
    else event.preventDefault();
  };

  const statusModeMatches = status?.mode ? status.mode === mode : true;

  return (
    <AuthModalShell
      open={open}
      onClose={onClose}
      panelClassName={`authui-auth-panel ${isSignUp ? "authui-signup" : "authui-signin"}`}
    >
      <div className="authui-header">
        <h3>{isSignUp ? resolveCopy(t, "auth.signUp", "Sign up") : resolveCopy(t, "nav.signIn", "Sign in")}</h3>
        <p>
          {isSignUp
            ? resolveCopy(
                t,
                "auth.subtitleSignUpTeaser",
                "Become a member to benefit from additional features and become a contributor."
              )
            : resolveCopy(t, "auth.subtitleSignIn", "Use your credentials to access your member area.")}
        </p>
      </div>
      <form className="authui-body" onSubmit={submitHandler}>
        {isSignUp ? (
          <>
            <div className="authui-grid-equal">
              <label>
                {resolveCopy(t, "auth.emailLabel", "Email")}
                <input
                  type="email"
                  value={form.email || ""}
                  onChange={(event) => mutateField("email", event.target.value)}
                  required
                />
              </label>
              <label>
                {resolveCopy(t, "auth.username", "Username")}
                <input
                  value={form.username || ""}
                  onChange={(event) => mutateField("username", event.target.value)}
                  required
                />
              </label>
            </div>
            <div className="authui-grid-equal">
              <label>
                {resolveCopy(t, "auth.firstName", "First name")}
                <input
                  value={form.firstName || ""}
                  onChange={(event) => mutateField("firstName", event.target.value)}
                  required
                />
              </label>
              <label>
                {resolveCopy(t, "auth.lastName", "Second name")}
                <input
                  value={form.lastName || ""}
                  onChange={(event) => mutateField("lastName", event.target.value)}
                  required
                />
              </label>
            </div>
            <div className="authui-grid-equal">
              <label>
                {resolveCopy(t, "auth.password", "Password")}
                <div className="authui-input-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password || ""}
                    onChange={(event) => mutateField("password", event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="authui-input-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <UiIcon name={showPassword ? "eyeOff" : "eye"} />
                  </button>
                </div>
              </label>
              <label>
                {resolveCopy(t, "auth.confirmPassword", "Confirm password")}
                <div className="authui-input-wrap">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={form.confirmPassword || ""}
                    onChange={(event) => mutateField("confirmPassword", event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="authui-input-toggle"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  >
                    <UiIcon name={showConfirmPassword ? "eyeOff" : "eye"} />
                  </button>
                </div>
              </label>
            </div>
            <div className="authui-grid-phone">
              <label>
                {resolveCopy(t, "auth.phoneCode", "Phone code")}
                <PhoneCodeSelect
                  value={form.phoneCountry || countryOptions[0]?.iso}
                  options={countryOptions}
                  onChange={(nextIso) => mutateField("phoneCountry", nextIso)}
                />
              </label>
              <label>
                {resolveCopy(t, "auth.phone", "Phone number")}
                <input
                  value={form.phoneNumber || ""}
                  onChange={(event) => mutateField("phoneNumber", sanitizeLocalPhoneDigits(event.target.value))}
                  inputMode="numeric"
                  pattern="[0-9]{7,15}"
                  maxLength={15}
                />
              </label>
            </div>
            <label>
              {resolveCopy(t, "auth.country", "Country")}
              <CountrySelect
                value={form.country || countryOptions[0]?.iso}
                options={countryOptions}
                onChange={(nextIso) => mutateField("country", nextIso)}
              />
            </label>
            <label>
              {resolveCopy(t, "auth.termsTitle", "Terms and conditions")}
              <textarea
                className="authui-terms"
                readOnly
                value={
                  termsLoading
                    ? resolveCopy(t, "auth.termsLoading", "Loading terms...")
                    : termsText || resolveCopy(t, "auth.termsEmpty", "No trade conditions configured yet.")
                }
              />
              {termLinks.length ? (
                <div className="authui-term-links">
                  {termLinks.map((item) => (
                    <a key={`${item.label}-${item.url}`} href={item.url} target="_blank" rel="noreferrer noopener">
                      {resolveCopy(t, "auth.openFullTerms", "Open full terms")}: {item.label}
                    </a>
                  ))}
                </div>
              ) : null}
            </label>
            <label className="authui-terms-check">
              <input
                type="checkbox"
                checked={Boolean(form.termsAccepted)}
                onChange={(event) => mutateField("termsAccepted", event.target.checked)}
              />
              <span>
                {resolveCopy(
                  t,
                  "auth.termsAccepted",
                  "I have read and understood the Terms and Conditions."
                )}
              </span>
            </label>
          </>
        ) : (
          <div className="authui-signin-layout">
            <div className="authui-signin-fields">
              <label>
                {resolveCopy(t, "auth.credential", "Username or email")}
                <input
                  value={form.credential || ""}
                  onChange={(event) => mutateField("credential", event.target.value)}
                  required
                />
              </label>
              <label>
                {resolveCopy(t, "auth.password", "Password")}
                <div className="authui-input-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password || ""}
                    onChange={(event) => mutateField("password", event.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="authui-input-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    <UiIcon name={showPassword ? "eyeOff" : "eye"} />
                  </button>
                </div>
              </label>
            </div>
            {visualImageUrl ? (
              <aside className="authui-signin-visual" aria-hidden="true">
                <img src={visualImageUrl} alt="" />
              </aside>
            ) : null}
          </div>
        )}
        {statusModeMatches && status?.error ? <p className="authui-alert authui-alert-error">{status.error}</p> : null}
        {statusModeMatches && status?.success ? (
          <p className="authui-alert authui-alert-success">{status.success}</p>
        ) : null}
        {status?.debugLink ? (
          <a className="authui-debug-link" href={status.debugLink}>
            Continue (dev shortcut)
          </a>
        ) : null}
        <div className="authui-actions">
          <button type="button" className="authui-btn authui-btn-ghost" onClick={onClose}>
            <UiIcon name="close" />
            {resolveCopy(t, "auth.close", "Close")}
          </button>
          <button type="submit" className="authui-btn" disabled={Boolean(status?.loading)}>
            <UiIcon name={isSignUp ? "userPlus" : "send"} />
            {status?.loading
              ? isSignUp
                ? resolveCopy(t, "auth.submittingSignUp", "Creating account...")
                : resolveCopy(t, "auth.submittingSignIn", "Signing in...")
              : isSignUp
                ? resolveCopy(t, "auth.submitSignUp", "Create account")
                : resolveCopy(t, "auth.submitSignIn", "Sign in")}
          </button>
        </div>
      </form>
    </AuthModalShell>
  );
}

export default MemberAuthModal;
