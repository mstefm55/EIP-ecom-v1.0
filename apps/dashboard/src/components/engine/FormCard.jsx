import { useMemo, useState } from "react";
import { runAction } from "../../engine/actions";

export default function FormCard({ node, ctx }) {
  const {
    title,
    subtitle,
    fields = [],
    submitLabel = "Submit",
    actionEvent,
    dataKey = "form",
    className = "",
  } = node.props || {};

  const initialValues = useMemo(() => {
    const values = {};
    fields.forEach((field) => {
      if (field?.name) {
        values[field.name] = field.defaultValue ?? "";
      }
    });
    return values;
  }, [fields]);

  const [values, setValues] = useState(initialValues);

  const updateValue = (name, value) => {
    setValues((prev) => {
      const next = { ...prev, [name]: value };
      ctx?.data?.setData?.(dataKey, next);
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    ctx?.data?.setData?.(dataKey, values);
    if (actionEvent) {
      await runAction(actionEvent, ctx);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`rounded-2xl border border-white/60 bg-white/85 p-5 shadow-soft ${className}`.trim()}
    >
      {title ? <h3 className="text-base font-semibold text-ink-900">{title}</h3> : null}
      {subtitle ? <p className="mt-1 text-sm text-ink-400">{subtitle}</p> : null}
      <div className="mt-4 space-y-3">
        {fields.map((field) => {
          const name = field.name || field.key;
          if (!name) return null;
          const type = field.type || "text";
          if (type === "select") {
            return (
              <label key={name} className="block text-xs font-semibold uppercase tracking-[0.25em] text-ink-400">
                <span className="mb-1 block">{field.label || name}</span>
                <select
                  value={values[name] ?? ""}
                  onChange={(event) => updateValue(name, event.target.value)}
                  className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-sm text-ink-700"
                >
                  {(field.options || []).map((option) => (
                    <option key={option.value ?? option} value={option.value ?? option}>
                      {option.label ?? option}
                    </option>
                  ))}
                </select>
              </label>
            );
          }
          return (
            <label key={name} className="block text-xs font-semibold uppercase tracking-[0.25em] text-ink-400">
              <span className="mb-1 block">{field.label || name}</span>
              <input
                type={type}
                value={values[name] ?? ""}
                onChange={(event) => updateValue(name, event.target.value)}
                placeholder={field.placeholder}
                className="w-full rounded-xl border border-ink-200/70 bg-white px-3 py-2 text-sm text-ink-700"
              />
            </label>
          );
        })}
      </div>
      <div className="mt-4 flex justify-end">
        <button
          type="submit"
          className="rounded-full bg-ink-900 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white shadow-glow"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
