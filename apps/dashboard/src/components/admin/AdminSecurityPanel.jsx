import { useEffect, useState } from "react";
import { ShieldCheck, Monitor, RefreshCw, UserCheck, XCircle } from "lucide-react";
import { apiFetch } from "../../services/apiClient";

export default function AdminSecurityPanel({ node }) {
  const { endpoint = "/api/eip/auth/devices" } = node.props || {};
  const [devices, setDevices] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [requestError, setRequestError] = useState(null);

  async function load() {
    setLoading(true);
    setError(null);
    setRequestError(null);
    try {
      const result = await apiFetch(endpoint);
      setDevices(Array.isArray(result?.devices) ? result.devices : []);
    } catch (err) {
      setError(err);
    }

    try {
      const recovery = await apiFetch("/api/eip/auth/recovery/requests?status=PENDING");
      if (recovery?.warning === "RECOVERY_TABLE_MISSING") {
        setRequestError(new Error("Recovery requests are currently unavailable."));
        setRequests([]);
      } else {
        setRequests(Array.isArray(recovery?.requests) ? recovery.requests : []);
      }
    } catch (err) {
      setRequestError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [endpoint]);

  return (
    <section className="glass-panel p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-ink-900">Security overview</h2>
          <p className="mt-1 text-sm text-ink-500">
            Monitor trusted devices and security posture for admin access.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-2 rounded-full border border-ink-200/70 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-ink-500 hover:bg-white"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="mt-4 rounded-2xl border border-ink-200/60 bg-white/70 px-4 py-3 text-sm text-ink-500">
          Loading devices...
        </div>
      ) : null}
      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {error.message || "Unable to load devices."}
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        {devices.length === 0 && !loading && !error ? (
          <div className="rounded-2xl border border-ink-200/60 bg-white/70 px-4 py-3 text-sm text-ink-500">
            No devices recorded yet.
          </div>
        ) : null}

        {devices.map((device) => (
          <div key={device.id} className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/80 px-4 py-4 shadow-soft">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ink-100 text-ink-500">
                <Monitor className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-900">{device.device_kind || "browser"}</p>
                <p className="text-xs text-ink-400">Last seen {device.last_seen_at || "-"}</p>
              </div>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                device.trust_state === "trusted"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {device.trust_state || "untrusted"}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-ink-900">Recovery requests</h3>
            <p className="mt-1 text-sm text-ink-500">
              Approve access when a user loses their authenticator.
            </p>
          </div>
        </div>

        {requestError ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {requestError.message || "Unable to load recovery requests."}
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {requests.length === 0 && !loading ? (
            <div className="rounded-2xl border border-ink-200/60 bg-white/70 px-4 py-3 text-sm text-ink-500">
              No pending recovery requests.
            </div>
          ) : null}

          {requests.map((req) => (
            <div key={req.id} className="flex items-center justify-between rounded-2xl border border-white/70 bg-white/80 px-4 py-4 shadow-soft">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-900">{req.login}</p>
                  <p className="text-xs text-ink-400">Requested {req.requested_at || "-"}</p>
                  {req.reason ? <p className="text-xs text-ink-400">Reason: {req.reason}</p> : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await apiFetch(`/api/eip/auth/recovery/requests/${req.id}/approve`, { method: "POST", body: {} });
                    await load();
                  }}
                  className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 hover:bg-emerald-100"
                >
                  <UserCheck className="h-4 w-4" />
                  Approve
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await apiFetch(`/api/eip/auth/recovery/requests/${req.id}/reject`, { method: "POST", body: {} });
                    await load();
                  }}
                  className="flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-rose-600 hover:bg-rose-100"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-emerald-200/60 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        <ShieldCheck className="h-4 w-4" />
        Step-up required for approving tenant onboarding and device trust changes.
      </div>
    </section>
  );
}
