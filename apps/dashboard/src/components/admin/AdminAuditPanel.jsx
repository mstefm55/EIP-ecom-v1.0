import { useMemo } from "react";
import { FileClock, ShieldAlert } from "lucide-react";

const sampleEvents = [
  {
    id: "evt-1",
    title: "Tenant access approved",
    detail: "Onboarding access package was issued.",
    time: "2 minutes ago",
  },
  {
    id: "evt-2",
    title: "Admin signed in",
    detail: "A secured administrator session was established.",
    time: "32 minutes ago",
  },
  {
    id: "evt-3",
    title: "Device trusted",
    detail: "Device verification was completed with OTP.",
    time: "1 hour ago",
  },
];

export default function AdminAuditPanel() {
  const events = useMemo(() => sampleEvents, []);

  return (
    <section className="glass-panel p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-ink-900">Audit trail</h2>
          <p className="mt-1 text-sm text-ink-500">
            Event log for onboarding, security, and admin operations.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-ink-200/70 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink-500">
          <FileClock className="h-4 w-4" />
          Live feed
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {events.map((event) => (
          <div key={event.id} className="flex items-start gap-4 rounded-2xl border border-white/70 bg-white/80 px-4 py-4 shadow-soft">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink-100 text-ink-500">
              <FileClock className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink-900">{event.title}</p>
              <p className="mt-1 text-sm text-ink-500">{event.detail}</p>
            </div>
            <span className="text-xs text-ink-400">{event.time}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-amber-200/60 bg-amber-50 px-4 py-3 text-sm text-amber-700">
        <ShieldAlert className="h-4 w-4" />
        Live audit feed is not available right now. Example events are shown.
      </div>
    </section>
  );
}
