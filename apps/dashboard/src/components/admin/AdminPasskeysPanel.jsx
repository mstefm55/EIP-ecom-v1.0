import { useEffect, useState } from "react";
import {
  Fingerprint,
  KeyRound,
  Laptop,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import {
  browserSupportsPasskeys,
  listPasskeys,
  platformPasskeyAvailable,
  registerPasskey,
  revokePasskey,
  stepUpWithPasskey,
} from "../../services/passkeys";

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatError(error, fallback) {
  const message = error?.message || "";
  const match = message.match(/API \d+:\s*(\{.*\})/s);
  if (match) {
    try {
      const payload = JSON.parse(match[1]);
      const code = payload?.error;
      const map = {
        STEP_UP_REQUIRED: "Complete step-up verification, then retry this passkey action.",
        PASSKEY_NOT_FOUND: "No active passkey is available for this account.",
        PASSKEY_CHALLENGE_INVALID: "The passkey challenge expired. Try again.",
        PASSKEY_VERIFICATION_FAILED: "Passkey verification failed.",
        PASSKEY_ALREADY_REGISTERED: "That passkey is already registered.",
        UNAUTHENTICATED: "Your session expired. Sign in again.",
        FORBIDDEN: "You do not have access to this action.",
      };
      if (map[code]) return map[code];
    } catch {
      // Fall through to the raw message.
    }
  }
  if (error?.name === "NotAllowedError") return "The passkey ceremony was cancelled or timed out.";
  if (error?.name === "SecurityError") return "The browser rejected this passkey request for the current origin.";
  return message || fallback;
}

export default function AdminPasskeysPanel() {
  const [passkeys, setPasskeys] = useState([]);
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState("");
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [supported, setSupported] = useState(true);
  const [platformAvailable, setPlatformAvailable] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const result = await listPasskeys();
      setPasskeys(Array.isArray(result?.passkeys) ? result.passkeys : []);
    } catch (err) {
      setError(formatError(err, "Unable to load passkeys."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setSupported(browserSupportsPasskeys());
    platformPasskeyAvailable().then(setPlatformAvailable);
    load();
  }, []);

  async function handleEnroll() {
    if (!supported) {
      setError("This browser does not support passkeys.");
      return;
    }
    setAction("enroll");
    setError(null);
    setNotice(null);
    try {
      await registerPasskey(label);
      setLabel("");
      setNotice("Passkey enrolled.");
      await load();
    } catch (err) {
      setError(formatError(err, "Unable to enroll passkey."));
    } finally {
      setAction("");
    }
  }

  async function handleStepUp() {
    if (!supported) {
      setError("This browser does not support passkeys.");
      return;
    }
    setAction("step-up");
    setError(null);
    setNotice(null);
    try {
      await stepUpWithPasskey();
      setNotice("Passkey step-up succeeded. This session is passkey verified.");
    } catch (err) {
      setError(formatError(err, "Passkey step-up failed."));
    } finally {
      setAction("");
    }
  }

  async function handleRevoke(passkey) {
    const ok = window.confirm(`Remove passkey "${passkey.label || "Passkey"}"?`);
    if (!ok) return;
    setAction(`revoke:${passkey.id}`);
    setError(null);
    setNotice(null);
    try {
      await revokePasskey(passkey.id);
      setNotice("Passkey removed.");
      await load();
    } catch (err) {
      setError(formatError(err, "Unable to remove passkey."));
    } finally {
      setAction("");
    }
  }

  const busy = Boolean(action);

  return (
    <div className="mt-8 rounded-3xl border border-white/70 bg-white/75 p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ink-900 text-white">
            <Fingerprint className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-ink-900">Passkeys</h3>
            <p className="mt-1 max-w-2xl text-sm text-ink-500">
              Enroll and test phishing-resistant sign-in before enabling passkey-required privileged actions.
            </p>
            <div className="mt-2 flex flex-wrap gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.2em]">
              <span className={`rounded-full px-2 py-1 ${supported ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-600"}`}>
                {supported ? "Browser ready" : "Unsupported browser"}
              </span>
              <span className="rounded-full bg-ink-100 px-2 py-1 text-ink-500">
                Platform authenticator {platformAvailable === null ? "checking" : platformAvailable ? "available" : "optional"}
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading || busy}
          className="flex items-center gap-2 rounded-full border border-ink-200/70 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink-500 hover:bg-ink-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {notice ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <label className="text-xs font-semibold uppercase tracking-[0.25em] text-ink-400">
          Passkey label
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Work laptop"
            className="mt-2 w-full rounded-2xl border border-ink-200/70 bg-white px-4 py-3 text-sm normal-case tracking-normal text-ink-700 placeholder:text-ink-300 focus:outline-none"
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={handleEnroll}
            disabled={busy || !supported}
            className="flex min-h-12 items-center gap-2 rounded-2xl bg-ink-900 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-glow disabled:bg-ink-300"
          >
            {action === "enroll" ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            Enroll
          </button>
          <button
            type="button"
            onClick={handleStepUp}
            disabled={busy || !supported || passkeys.length === 0}
            className="flex min-h-12 items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
          >
            {action === "step-up" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Test step-up
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-ink-200/60 bg-white/70 px-4 py-3 text-sm text-ink-500">
            Loading passkeys...
          </div>
        ) : null}

        {!loading && passkeys.length === 0 ? (
          <div className="rounded-2xl border border-ink-200/60 bg-white/70 px-4 py-4 text-sm text-ink-500">
            No passkeys enrolled yet.
          </div>
        ) : null}

        {passkeys.map((passkey) => (
          <div key={passkey.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/85 px-4 py-4 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink-100 text-ink-500">
                <Laptop className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-900">{passkey.label || "Passkey"}</p>
                <p className="text-xs text-ink-400">
                  Last used {formatDate(passkey.last_used_at)} / Created {formatDate(passkey.created_at)}
                </p>
                <p className="mt-1 text-[0.65rem] uppercase tracking-[0.2em] text-ink-400">
                  {passkey.device_type || "device"} {passkey.backed_up ? "/ backed up" : ""}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleRevoke(passkey)}
              disabled={busy}
              className="flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-rose-600 hover:bg-rose-100 disabled:opacity-50"
            >
              {action === `revoke:${passkey.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
