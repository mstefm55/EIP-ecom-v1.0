import {
  X,
  Mail,
  Lock,
  Building2,
  Check,
  Phone,
  Globe,
  Clock,
  User,
  IdCard,
  FileText,
  Briefcase
} from "lucide-react";
import { runAction } from "../../engine/actions";

export default function AuthModal({ node, ctx, children }) {
  const {
    title,
    subtitle,
    action,
    actionEvent,
    fields = [],
    scope = "auth",
    variant = "form",
  } = node.props || {};
  const isOpen = ctx?.modal?.id === node?.id;
  const status =
    scope === "request"
      ? ctx?.requestAccess?.status
      : scope === "reset"
        ? ctx?.reset?.status
        : scope === "recovery"
          ? ctx?.recovery?.status
          : ctx?.auth?.status;
  const form =
    scope === "request"
      ? ctx?.requestAccess?.form
      : scope === "reset"
        ? ctx?.reset?.form
        : scope === "recovery"
          ? ctx?.recovery?.form
          : ctx?.auth?.form;
  const setField =
    scope === "request"
      ? ctx?.requestAccess?.setField
      : scope === "reset"
        ? ctx?.reset?.setField
        : scope === "recovery"
          ? ctx?.recovery?.setField
          : ctx?.auth?.setField;
  const orgOptions = Array.isArray(ctx?.auth?.organisations) ? ctx.auth.organisations : [];

  if (!isOpen) return null;

  const iconFor = (field) => {
    if (field.type === "checkbox") return Check;
    if (field.key === "organisation") return Building2;
    if (field.key === "email") return Mail;
    if (field.key === "password" || field.key === "confirmPassword") return Lock;
    if (field.key === "phone") return Phone;
    if (field.key === "country") return Globe;
    if (field.key === "timezone") return Clock;
    if (field.key === "legalName") return Building2;
    if (field.key === "businessRegNo") return FileText;
    if (field.key === "personalIdNo") return IdCard;
    if (field.key === "applicantType") return Briefcase;
    return User;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-4 py-8 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/40 bg-white/90 p-6 shadow-strong">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-semibold text-ink-800">{title}</h3>
            <p className="mt-1 text-sm text-ink-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => ctx?.modal?.close?.()}
            className="rounded-full border border-ink-200/70 bg-white/80 p-2 text-ink-500 hover:text-ink-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 min-h-0 flex-1 space-y-4 overflow-y-auto pr-2">
          {variant === "form" ? (
            <>
              {fields.map((field) => {
                const Icon = iconFor(field);
                const fieldScope = field.scope || scope;
                const scopedForm =
                  fieldScope === "otp"
                    ? { otp: ctx?.otp?.code || "" }
                    : fieldScope === "request"
                      ? ctx?.requestAccess?.form
                      : fieldScope === "reset"
                        ? ctx?.reset?.form
                        : fieldScope === "recovery"
                          ? ctx?.recovery?.form
                          : ctx?.auth?.form;
                const scopedSetter =
                  fieldScope === "otp"
                    ? ctx?.otp?.setCode
                    : fieldScope === "request"
                      ? ctx?.requestAccess?.setField
                      : fieldScope === "reset"
                        ? ctx?.reset?.setField
                        : fieldScope === "recovery"
                          ? ctx?.recovery?.setField
                          : ctx?.auth?.setField;
                const value = scopedForm?.[field.key] ?? (field.type === "checkbox" ? false : "");
                const selectOptions =
                  field.key === "organisation" && orgOptions.length
                    ? orgOptions.map((org) => ({
                        value: org.code || org.id,
                        label: org.name ? `${org.name} (${org.code || org.id})` : org.code || org.id,
                      }))
                    : field.options || [];
                const useSelect = field.type === "select" || (field.key === "organisation" && selectOptions.length);
                const applyValue = (next) => {
                  if (fieldScope === "otp") {
                    scopedSetter?.(next);
                  } else {
                    scopedSetter?.(field.key, next);
                  }
                };

                if (field.type === "terms") {
                  return (
                    <div
                      key={field.key}
                      className="max-h-40 overflow-y-scroll rounded-2xl border border-ink-200/60 bg-white/70 p-4 pr-4 text-xs text-ink-600"
                      style={{ scrollbarGutter: "stable" }}
                    >
                      <p className="whitespace-pre-line leading-relaxed">{field.content}</p>
                    </div>
                  );
                }

                if (field.type === "checkbox") {
                  return (
                    <label key={field.key} className="flex items-center gap-3 rounded-2xl border border-ink-200/60 bg-white px-4 py-3 text-sm text-ink-600">
                      <input
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={(event) => applyValue(event.target.checked)}
                      />
                      <span>{field.label}</span>
                    </label>
                  );
                }

                return (
                  <label key={field.key} className="block">
                    <span className="text-xs uppercase tracking-[0.3em] text-ink-400">{field.label}</span>
                    <div className="mt-2 flex items-center gap-3 rounded-2xl border border-ink-200/60 bg-white px-4 py-3">
                      <Icon className="h-4 w-4 text-ink-400" />
                      {useSelect ? (
                        <select
                          value={value}
                          onChange={(event) => applyValue(event.target.value)}
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
                          type={field.type || "text"}
                          placeholder={field.placeholder}
                          value={value}
                          onChange={(event) => applyValue(event.target.value)}
                          className="w-full bg-transparent text-sm text-ink-700 placeholder:text-ink-300 focus:outline-none"
                        />
                      )}
                    </div>
                  </label>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  if (actionEvent) {
                    runAction(actionEvent, ctx);
                  } else if (scope === "request") {
                    ctx?.requestAccess?.submit?.();
                  } else if (scope === "reset") {
                    ctx?.reset?.submit?.();
                  } else if (scope === "recovery") {
                    ctx?.recovery?.submit?.();
                  } else if (scope === "auth") {
                    ctx?.otp?.verify?.();
                  }
                }}
                className="w-full rounded-2xl bg-ink-900 px-5 py-3 text-sm font-semibold text-white shadow-glow hover:bg-ink-800"
              >
                {action}
              </button>
            </>
          ) : (
            children
          )}

          {status ? (
            <p
              className={
                status.type === "error"
                  ? "text-xs text-rose-500"
                  : "text-xs text-emerald-600"
              }
            >
              {status.message}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
