import { ShieldCheck } from "lucide-react";
import AdminPasskeysPanel from "../admin/AdminPasskeysPanel";

export default function UserSecurityPanel() {
  return (
    <section className="glass-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink-900">Security</h2>
          <p className="mt-1 text-sm text-ink-500">
            Enroll a passkey once, then use it for future sign-ins instead of requesting an email OTP.
            OTP and TOTP remain available as recovery methods.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-emerald-200/70 bg-emerald-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
          <ShieldCheck className="h-4 w-4" />
          Self-service
        </div>
      </div>

      <AdminPasskeysPanel
        title="Your passkeys"
        description="Use your device fingerprint, face, PIN, or security key for tenant dashboard sign-in. After enrollment, choose Use passkey on the sign-in page."
        className="mt-6 rounded-2xl border border-white/70 bg-white/75 p-5 shadow-soft"
      />
    </section>
  );
}
