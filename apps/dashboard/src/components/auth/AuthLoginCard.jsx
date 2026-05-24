import { useEffect, useMemo } from "react";
import { ArrowRight, Lock, Mail, Building2, KeyRound } from "lucide-react";
import { runAction } from "../../engine/actions";

const iconMap = {
  tenant: Building2,
  organisation: Building2,
  organization: Building2,
  email: Mail,
  password: Lock,
  totp: KeyRound,
};

const labelIconMap = {
  Tenant: Building2,
  Organisation: Building2,
  Organization: Building2,
  Email: Mail,
  Password: Lock,
  TOTP: KeyRound,
};

export default function AuthLoginCard({ node, ctx }) {
  const {
    title,
    subtitle,
    fields = [],
    primaryAction,
    secondaryAction,
    primaryEvent,
    secondaryEvent,
    totpAction,
    totpEvent,
    totpLoginAction,
    totpLoginEvent,
    passkeyLoginAction = "Use passkey",
    passkeyLoginEvent = "passkey-login",
    hidePasskeyLogin = false,
    showTotp,
    footnote,
    modalLabel,
    showModal,
    modalEvent,
    forgotLabel,
    forgotEvent,
    recoveryLabel,
    recoveryEvent,
  } = node.props || {};
  const status = ctx?.auth?.status;
  const canShowModal = showModal === true;
  const canShowTotp = showTotp === true;
  const orgOptions = Array.isArray(ctx?.auth?.organisations) ? ctx.auth.organisations : [];
  const orgStatus = ctx?.auth?.orgStatus;
  const primarySuccessModal = node.props?.primarySuccessModal;
  const organisationValue = ctx?.auth?.form?.organisation ?? "";
  const showPasskeyLogin =
    hidePasskeyLogin !== true &&
    typeof ctx?.auth?.passkeyLogin === "function" &&
    Boolean(passkeyLoginAction);

  useEffect(() => {
    if (!organisationValue && orgOptions.length) {
      const first = orgOptions[0];
      const value = first?.code || first?.id || "";
      if (value) {
        ctx?.auth?.setField?.("organisation", value);
      }
    }
  }, [organisationValue, orgOptions, ctx]);

  const hasRequestOtp = (value) => {
    if (!value) return false;
    if (Array.isArray(value)) return value.includes("request-otp");
    return value === "request-otp";
  };

  const resolvedOtpModal = primarySuccessModal || (hasRequestOtp(primaryEvent) ? "otp-modal" : null);

  const handlePrimary = async () => {
    let result;
    if (primaryEvent) {
      result = await runAction(primaryEvent, ctx);
    } else {
      result = await ctx?.auth?.requestOtp?.();
    }
    if (resolvedOtpModal && result?.ok) {
      ctx?.modal?.open?.(resolvedOtpModal);
    }
  };

  const resolvedFields = useMemo(() => {
    if (!canShowTotp) return fields;
    const hasTotp = fields.some(
      (field) => field.key === "totp" || field.label?.toLowerCase().includes("totp")
    );
    if (hasTotp) return fields;
    return [
      ...fields,
      { label: "TOTP Code", key: "totp", placeholder: "123 456" }
    ];
  }, [fields, canShowTotp]);

  return (
    <div className="glass-panel p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-ink-800">{title}</h3>
          <p className="mt-1 text-sm text-ink-500">{subtitle}</p>
        </div>
        {canShowModal ? (
          <button
            type="button"
            onClick={() => runAction(modalEvent, ctx)}
            className="rounded-full border border-ink-200/70 bg-white/70 px-3 py-1 text-[0.65rem] uppercase tracking-[0.25em] text-ink-500"
          >
            {modalLabel || "Modal"}
          </button>
        ) : null}
      </div>

      <div className="mt-6 space-y-4">
        {resolvedFields.map((field) => {
          const key = field.key || field.label?.toLowerCase();
          const Icon = iconMap[key] || labelIconMap[field.label] || Mail;
          const isPassword = field.type === "password" || field.label === "Password";
          const formValue = ctx?.auth?.form?.[key] ?? "";
          const selectOptions =
            key === "organisation" && orgOptions.length
              ? orgOptions.map((org) => ({
                  value: org.code || org.id,
                  label: org.name ? `${org.name} (${org.code || org.id})` : org.code || org.id,
                }))
              : field.options || [];
          const useSelect = field.type === "select" || (key === "organisation" && selectOptions.length);
          const isEmail = key === "email";
          return (
            <label key={field.label} className="block">
              <span className="text-xs uppercase tracking-[0.3em] text-ink-400">{field.label}</span>
              <div className="mt-2 flex items-center gap-3 rounded-2xl border border-white/50 bg-white/70 px-4 py-3 shadow-soft">
                <Icon className="h-4 w-4 text-ink-400" />
                {useSelect ? (
                  <select
                    value={formValue}
                    onChange={(event) => ctx?.auth?.setField?.(key, event.target.value)}
                    className="w-full bg-transparent text-sm text-ink-700 focus:outline-none"
                  >
                    {selectOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={isPassword ? "password" : field.type || "text"}
                    placeholder={field.placeholder}
                    value={formValue}
                    onChange={(event) => {
                      const next = event.target.value;
                      ctx?.auth?.setField?.(key, next);
                    }}
                    onBlur={() => {
                      if (isEmail) ctx?.auth?.resolveOrganisations?.();
                    }}
                    onKeyDown={(event) => {
                      if (isEmail && event.key === "Enter") {
                        event.preventDefault();
                        ctx?.auth?.resolveOrganisations?.();
                      }
                    }}
                    className="w-full bg-transparent text-sm text-ink-700 placeholder:text-ink-300 focus:outline-none"
                  />
                )}
              </div>
              {key === "organisation" && orgStatus ? (
                <div className="mt-2 text-xs text-ink-400">{orgStatus}</div>
              ) : null}
            </label>
          );
        })}
      </div>

      <div className="mt-6 grid gap-3">
        <button
          type="button"
          onClick={handlePrimary}
          className="group flex w-full items-center justify-between rounded-2xl bg-ink-900 px-5 py-3 text-sm font-semibold text-white shadow-glow hover:bg-ink-800"
        >
          {primaryAction}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </button>
        <button
          type="button"
          onClick={() => {
            if (secondaryEvent) {
              runAction(secondaryEvent, ctx);
            } else {
              ctx?.auth?.passwordLogin?.();
            }
          }}
          className="w-full rounded-2xl border border-ink-200/70 bg-white/70 px-5 py-3 text-sm font-semibold text-ink-600 hover:bg-white"
        >
          {secondaryAction}
        </button>
        {totpLoginAction ? (
          <button
            type="button"
            onClick={() => {
              if (totpLoginEvent) {
                runAction(totpLoginEvent, ctx);
              } else {
                ctx?.auth?.verifyTotp?.();
              }
            }}
            className="w-full rounded-2xl border border-ink-200/70 bg-white/70 px-5 py-3 text-sm font-semibold text-ink-600 hover:bg-white"
          >
            {totpLoginAction}
          </button>
        ) : null}
        {showPasskeyLogin ? (
          <button
            type="button"
            onClick={() => {
              if (passkeyLoginEvent) {
                runAction(passkeyLoginEvent, ctx);
              } else {
                ctx?.auth?.passkeyLogin?.();
              }
            }}
            className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
          >
            {passkeyLoginAction}
          </button>
        ) : null}
      </div>

      {canShowTotp ? (
        <button
          type="button"
          onClick={() => runAction(totpEvent, ctx)}
          className="mt-3 w-full rounded-2xl border border-ink-200/70 bg-white/70 px-5 py-3 text-sm font-semibold text-ink-600 hover:bg-white"
        >
          {totpAction}
        </button>
      ) : null}

      <div className="mt-4 flex items-center justify-between text-xs text-ink-400">
        <span>{footnote}</span>
        <div className="flex items-center gap-3">
          {forgotLabel ? (
            <button
              type="button"
              onClick={() => runAction(forgotEvent, ctx)}
              className="text-xs font-semibold text-ink-600 hover:text-ink-900"
            >
              {forgotLabel}
            </button>
          ) : null}
          {recoveryLabel ? (
            <button
              type="button"
              onClick={() => runAction(recoveryEvent, ctx)}
              className="text-xs font-semibold text-ink-600 hover:text-ink-900"
            >
              {recoveryLabel}
            </button>
          ) : null}
        </div>
      </div>
      {status ? (
        <p
          className={
            status.type === "error"
              ? "mt-3 text-xs text-rose-500"
              : "mt-3 text-xs text-emerald-600"
          }
        >
          {status.message}
        </p>
      ) : null}
    </div>
  );
}
