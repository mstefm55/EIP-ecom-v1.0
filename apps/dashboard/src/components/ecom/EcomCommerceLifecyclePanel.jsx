import { useEffect, useState } from "react";
import { Box, CreditCard, Settings } from "lucide-react";

const STORAGE_KEY = "ecom.commerce.settings";

const DEFAULT_SETTINGS = {
  order_policy: { allow_return: true, allow_refund: true },
  payment_policy: { allow_return: true, allow_refund: true },
  refund_policy: { request_enabled: true, auto_approve: false },
};

const ORDER_FLOW_STEPS = [
  { id: "created", label: "Created", tone: "border-slate-200 bg-slate-50 text-slate-700" },
  { id: "confirmed", label: "Confirmed", tone: "border-sky-200 bg-sky-50 text-sky-700" },
  { id: "fulfilled", label: "Fulfilled", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  { id: "completed", label: "Completed", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
];

const ORDER_EXCEPTION_STEPS = [
  { id: "cancelled", label: "Cancelled", tone: "border-rose-200 bg-rose-50 text-rose-700" },
  { id: "returned", label: "Returned", tone: "border-amber-200 bg-amber-50 text-amber-700", optional: "return" },
  { id: "refunded", label: "Refunded", tone: "border-indigo-200 bg-indigo-50 text-indigo-700", optional: "refund" },
];

const PAYMENT_FLOW_STEPS = [
  { id: "initiated", label: "Initiated", tone: "border-slate-200 bg-slate-50 text-slate-700" },
  { id: "authorized", label: "Authorized", tone: "border-amber-200 bg-amber-50 text-amber-700" },
  { id: "captured", label: "Captured", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  { id: "completed", label: "Completed", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
];

const PAYMENT_EXCEPTION_STEPS = [
  { id: "failed", label: "Failed", tone: "border-rose-200 bg-rose-50 text-rose-700" },
  { id: "cancelled", label: "Cancelled", tone: "border-rose-200 bg-rose-50 text-rose-700" },
  { id: "returned", label: "Return", tone: "border-amber-200 bg-amber-50 text-amber-700", optional: "return" },
  { id: "refunded", label: "Refunded", tone: "border-indigo-200 bg-indigo-50 text-indigo-700", optional: "refund" },
];

function mergeSettings(base, override) {
  if (!override || typeof override !== "object") return base;
  return {
    ...base,
    ...override,
    order_policy: { ...base.order_policy, ...(override.order_policy || {}) },
    payment_policy: { ...base.payment_policy, ...(override.payment_policy || {}) },
    refund_policy: { ...base.refund_policy, ...(override.refund_policy || {}) },
  };
}

function loadSettings() {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return mergeSettings(DEFAULT_SETTINGS, JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function persistSettings(settings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage failures
  }
}

export default function EcomCommerceLifecyclePanel() {
  const [settings, setSettings] = useState(() => loadSettings());
  const [savedNote, setSavedNote] = useState("");

  useEffect(() => {
    persistSettings(settings);
    setSavedNote("Settings saved");
    const timer = setTimeout(() => setSavedNote(""), 2000);
    return () => clearTimeout(timer);
  }, [settings]);

  const updateSetting = (path, value) => {
    setSettings((prev) => {
      const next = { ...prev };
      let cursor = next;
      for (let i = 0; i < path.length - 1; i += 1) {
        const key = path[i];
        cursor[key] = { ...(cursor[key] || {}) };
        cursor = cursor[key];
      }
      cursor[path[path.length - 1]] = value;
      return next;
    });
  };

  const orderPolicy = settings.order_policy || {};
  const paymentPolicy = settings.payment_policy || {};
  const refundPolicy = settings.refund_policy || {};
  const allowOrderReturn = orderPolicy.allow_return ?? true;
  const allowOrderRefund = orderPolicy.allow_refund ?? true;
  const allowPaymentReturn = paymentPolicy.allow_return ?? true;
  const allowPaymentRefund = paymentPolicy.allow_refund ?? true;
  const refundRequestEnabled = refundPolicy.request_enabled ?? true;
  const refundAutoApprove = refundPolicy.auto_approve ?? false;

  const refundApprovalLabel = refundAutoApprove ? "Auto approval" : "Human approval";
  const refundApprovalTone = refundAutoApprove
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <section className="space-y-6">
      <div className="glass-panel flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-ink-400">Commerce</p>
          <h2 className="text-2xl font-semibold text-ink-900">Order & payment operations</h2>
          <p className="mt-1 text-sm text-ink-500">
            Configure lifecycle paths and refund approval settings for this tenant.
          </p>
        </div>
        {savedNote ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-emerald-700">
            {savedNote}
          </span>
        ) : null}
      </div>

      <div className="glass-panel space-y-6 p-6">
        <div className="rounded-2xl border border-ink-100 bg-white/70 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-ink-400">
                <Box className="h-4 w-4 text-ink-400" />
                Lifecycle controls
              </div>
              <p className="mt-2 text-[0.7rem] text-ink-500">
                Enable or disable optional return and refund paths for orders and payments.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                <input
                  type="checkbox"
                  checked={allowOrderReturn}
                  onChange={(event) =>
                    updateSetting(["order_policy", "allow_return"], event.target.checked)
                  }
                  className="h-4 w-4 rounded border-ink-300 text-ink-900"
                />
                Order returns
              </label>
              <label className="flex items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                <input
                  type="checkbox"
                  checked={allowOrderRefund}
                  onChange={(event) =>
                    updateSetting(["order_policy", "allow_refund"], event.target.checked)
                  }
                  className="h-4 w-4 rounded border-ink-300 text-ink-900"
                />
                Order refunds
              </label>
              <label className="flex items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                <input
                  type="checkbox"
                  checked={allowPaymentReturn}
                  onChange={(event) =>
                    updateSetting(["payment_policy", "allow_return"], event.target.checked)
                  }
                  className="h-4 w-4 rounded border-ink-300 text-ink-900"
                />
                Payment returns
              </label>
              <label className="flex items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                <input
                  type="checkbox"
                  checked={allowPaymentRefund}
                  onChange={(event) =>
                    updateSetting(["payment_policy", "allow_refund"], event.target.checked)
                  }
                  className="h-4 w-4 rounded border-ink-300 text-ink-900"
                />
                Payment refunds
              </label>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-xl border border-white/70 bg-white/80 p-4">
              <div className="flex items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-ink-400">
                <Box className="h-4 w-4 text-ink-400" />
                Order flow
              </div>
              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-ink-400">
                    Primary flow
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ORDER_FLOW_STEPS.map((step) => (
                      <FlowStep key={step.id} label={step.label} tone={step.tone} />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-ink-400">
                    Exceptions
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ORDER_EXCEPTION_STEPS.map((step) => {
                      const disabled =
                        (step.optional === "return" && !allowOrderReturn) ||
                        (step.optional === "refund" && !allowOrderRefund);
                      return (
                        <FlowStep
                          key={step.id}
                          label={step.label}
                          tone={step.tone}
                          disabled={disabled}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-white/70 bg-white/80 p-4">
              <div className="flex items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-ink-400">
                <CreditCard className="h-4 w-4 text-ink-400" />
                Payment flow
              </div>
              <div className="mt-3 space-y-3">
                <div>
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-ink-400">
                    Primary flow
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {PAYMENT_FLOW_STEPS.map((step) => (
                      <FlowStep key={step.id} label={step.label} tone={step.tone} />
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-ink-400">
                    Exceptions
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {PAYMENT_EXCEPTION_STEPS.map((step) => {
                      const disabled =
                        (step.optional === "return" && !allowPaymentReturn) ||
                        (step.optional === "refund" && !allowPaymentRefund);
                      return (
                        <FlowStep
                          key={step.id}
                          label={step.label}
                          tone={step.tone}
                          disabled={disabled}
                        />
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-ink-100 bg-white/70 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.3em] text-ink-400">
                <Settings className="h-4 w-4 text-ink-400" />
                Refund request settings
              </div>
              <p className="mt-2 text-[0.7rem] text-ink-500">
                Control whether customers can request refunds and how approvals are handled.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                <input
                  type="checkbox"
                  checked={refundRequestEnabled}
                  onChange={(event) =>
                    updateSetting(["refund_policy", "request_enabled"], event.target.checked)
                  }
                  className="h-4 w-4 rounded border-ink-300 text-ink-900"
                />
                Customer refund requests
              </label>
              <label className="flex items-center gap-2 text-[0.6rem] font-semibold uppercase tracking-[0.25em] text-ink-400">
                <input
                  type="checkbox"
                  checked={refundAutoApprove}
                  disabled={!refundRequestEnabled}
                  onChange={(event) =>
                    updateSetting(["refund_policy", "auto_approve"], event.target.checked)
                  }
                  className="h-4 w-4 rounded border-ink-300 text-ink-900 disabled:opacity-50"
                />
                Auto-approve refunds
              </label>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <FlowStep
              label="Customer request"
              tone="border-sky-200 bg-sky-50 text-sky-700"
              disabled={!refundRequestEnabled}
            />
            <FlowStep
              label={refundApprovalLabel}
              tone={refundApprovalTone}
              disabled={!refundRequestEnabled}
            />
            <FlowStep
              label="Refund issued"
              tone="border-indigo-200 bg-indigo-50 text-indigo-700"
              disabled={!refundRequestEnabled}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function FlowStep({ label, tone, disabled = false }) {
  const base =
    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.25em]";
  const activeTone = tone || "border-white/60 bg-white/80 text-ink-600";
  const disabledTone = "border-dashed border-ink-200/70 bg-white/60 text-ink-300";
  return <span className={`${base} ${disabled ? disabledTone : activeTone}`}>{label}</span>;
}
