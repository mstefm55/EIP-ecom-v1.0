import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { QrCode, Copy, ShieldCheck, Eye, EyeOff } from "lucide-react";

export default function AuthTotpCard({ node, ctx }) {
  const {
    title,
    subtitle,
    issuer,
    account,
    secret,
    qrValue,
    verifyAction,
    backupAction,
  } = node.props || {};
  const enrollment = ctx?.totp?.enrollment;
  const authForm = ctx?.auth?.form || {};
  const setAuthField = ctx?.auth?.setField;
  const orgOptions = Array.isArray(ctx?.auth?.organisations) ? ctx.auth.organisations : [];
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [revealSecret, setRevealSecret] = useState(false);
  const secretValue = enrollment?.secret || secret;
  const uriValue = enrollment?.uri || qrValue;
  const allowPreview = node.props?.preview === true;
  const embedded = node.props?.embedded === true;
  const showEnrollment = Boolean(enrollment);
  const showSecret = showEnrollment && Boolean(secretValue);
  const showQr = (showEnrollment || allowPreview) && Boolean(uriValue);
  const maskedSecret = useMemo(() => (secretValue ? "************" : ""), [secretValue]);

  useEffect(() => {
    let active = true;
    if (!showQr) {
      setQrDataUrl("");
      return undefined;
    }
    QRCode.toDataURL(uriValue, {
      margin: 1,
      width: 200,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl("");
      });
    return () => {
      active = false;
    };
  }, [uriValue, showQr]);

  return (
    <div className={embedded ? "p-2" : "glass-panel p-7"}>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xl font-semibold text-ink-800">{title}</h3>
          <p className="mt-1 text-sm text-ink-500">{subtitle}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
          <QrCode className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="qr-frame">
          {showQr && qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="TOTP QR"
              className="mx-auto h-48 w-48 rounded-2xl bg-white p-2 shadow-soft"
            />
          ) : (
            <div className="qr-grid flex items-center justify-center text-xs text-ink-400">
              QR pending
            </div>
          )}
          {!showEnrollment ? (
            <p className="mt-3 text-xs text-ink-400">
              Start TOTP setup to generate a QR code.
            </p>
          ) : null}
          <div className="mt-3 flex items-center justify-between text-xs text-ink-400">
            <span>{issuer}</span>
            <span>{account}</span>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-dashed border-ink-200/80 bg-white/70 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-ink-400">Confirm credentials</p>
            <div className="mt-3 grid gap-3">
              <label className="block">
                <span className="text-[0.65rem] uppercase tracking-[0.25em] text-ink-400">Email</span>
                <input
                  type="email"
                  placeholder="ops@organisation.com"
                  value={authForm.email || ""}
                  onChange={(event) => setAuthField?.("email", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/60 bg-white/70 px-4 py-2 text-sm text-ink-700 placeholder:text-ink-300 shadow-soft focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="text-[0.65rem] uppercase tracking-[0.25em] text-ink-400">Organisation</span>
                {orgOptions.length ? (
                  <select
                    value={authForm.organisation || ""}
                    onChange={(event) => setAuthField?.("organisation", event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/60 bg-white/70 px-4 py-2 text-sm text-ink-700 shadow-soft focus:outline-none"
                  >
                    {orgOptions.map((org) => {
                      const value = org.code || org.id;
                      const label = org.name ? `${org.name} (${value})` : value;
                      return (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="Organisation code"
                    value={authForm.organisation || ""}
                    onChange={(event) => setAuthField?.("organisation", event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/60 bg-white/70 px-4 py-2 text-sm text-ink-700 placeholder:text-ink-300 shadow-soft focus:outline-none"
                  />
                )}
              </label>
              <label className="block">
                <span className="text-[0.65rem] uppercase tracking-[0.25em] text-ink-400">Password</span>
                <input
                  type="password"
                  placeholder="********"
                  value={authForm.password || ""}
                  onChange={(event) => setAuthField?.("password", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/60 bg-white/70 px-4 py-2 text-sm text-ink-700 placeholder:text-ink-300 shadow-soft focus:outline-none"
                />
              </label>
            </div>
          </div>

          {showSecret ? (
            <div className="rounded-2xl border border-dashed border-ink-200/80 bg-white/70 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-ink-400">Secret</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-mono text-sm text-ink-700">
                  {revealSecret ? secretValue : maskedSecret}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRevealSecret((prev) => !prev)}
                    className="inline-flex items-center gap-1 text-xs text-ink-500"
                  >
                    {revealSecret ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    {revealSecret ? "Hide" : "Reveal"}
                  </button>
                  {revealSecret ? (
                    <button
                      type="button"
                      onClick={() => navigator.clipboard?.writeText?.(secretValue || "")}
                      className="inline-flex items-center gap-1 text-xs text-ink-500"
                    >
                      <Copy className="h-3 w-3" />
                      Copy
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-ink-200/80 bg-white/70 p-4 text-xs text-ink-400">
              Secret will appear after setup starts.
            </div>
          )}

          <label className="block">
            <span className="text-xs uppercase tracking-[0.3em] text-ink-400">Verification code</span>
            <input
              type="text"
              placeholder="123 456"
              value={ctx?.totp?.code || ""}
              onChange={(event) => ctx?.totp?.setCode?.(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-white/60 bg-white/70 px-4 py-3 text-sm text-ink-700 placeholder:text-ink-300 shadow-soft focus:outline-none"
            />
            <p className="mt-2 text-xs text-ink-400">
              Enter a code once to activate TOTP (QR scan alone does not enable it).
            </p>
          </label>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => ctx?.totp?.confirm?.()}
              className="rounded-2xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-glow hover:bg-brand-700"
            >
              {verifyAction}
            </button>
            <button
              type="button"
              onClick={() => ctx?.totp?.enroll?.()}
              className="rounded-2xl border border-ink-200/70 bg-white/70 px-5 py-3 text-sm font-semibold text-ink-600 hover:bg-white"
            >
              {backupAction}
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-ink-400">
        <ShieldCheck className="h-3 w-3" />
        QR code is protected and expires after setup.
      </div>
    </div>
  );
}
