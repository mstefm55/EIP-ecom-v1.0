import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  EIP_LANGUAGE_OPTIONS,
  getEipLanguageMetadata,
  normalizeEipLocale,
  translateEipText,
} from "./eipLanguageLibrary";

const STORAGE_KEY = "eip.dashboard.language";
const EipLanguageContext = createContext(null);

const SKIP_TRANSLATION_KEYS = new Set([
  "id",
  "code",
  "key",
  "tab",
  "type",
  "icon",
  "module",
  "scope",
  "variant",
  "tone",
  "className",
  "titleClass",
  "endpoint",
  "url",
  "href",
  "path",
  "route",
  "actionEvent",
  "primaryEvent",
  "secondaryEvent",
  "totpEvent",
  "quickAction",
  "ctaAction",
  "event",
  "events",
  "value",
  "objectType",
  "object_type",
  "serviceObjectType",
  "service_object_type",
  "selector",
  "slot",
  "field",
  "api",
]);

function safeReadStoredLanguage() {
  if (typeof window === "undefined") return "en";
  try {
    return normalizeEipLocale(window.localStorage.getItem(STORAGE_KEY) || "en");
  } catch {
    return "en";
  }
}

export function EipLanguageProvider({ children }) {
  const [language, setLanguageState] = useState(safeReadStoredLanguage);

  const setLanguage = useCallback((value) => {
    const next = normalizeEipLocale(value);
    setLanguageState(next);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Ignore private-mode/localStorage failures.
      }
    }
  }, []);

  const metadata = getEipLanguageMetadata(language);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = metadata.code;
    document.documentElement.dir = metadata.direction || "ltr";
  }, [metadata]);

  const t = useCallback((text) => translateEipText(text, language), [language]);

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      languageOptions: EIP_LANGUAGE_OPTIONS,
      metadata,
      t,
      translateText: t,
    }),
    [language, metadata, setLanguage, t]
  );

  return (
    <EipLanguageContext.Provider value={value}>
      {children}
    </EipLanguageContext.Provider>
  );
}

export function useEipLanguage() {
  const value = useContext(EipLanguageContext);
  if (value) return value;
  return {
    language: "en",
    setLanguage: () => {},
    languageOptions: EIP_LANGUAGE_OPTIONS,
    metadata: getEipLanguageMetadata("en"),
    t: (text) => text,
    translateText: (text) => text,
  };
}

export function EipLanguageSwitcher({ compact = false, className = "" }) {
  const { language, setLanguage, languageOptions, t } = useEipLanguage();
  return (
    <label
      className={`eip-language-switcher inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/80 px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-ink-600 shadow-soft ${className}`}
      title={t("Language")}
    >
      {!compact ? <span>{t("Language")}</span> : null}
      <select
        className="bg-transparent text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-ink-700 outline-none"
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        aria-label={t("Language")}
      >
        {languageOptions.map((item) => (
          <option key={item.code} value={item.code}>
            {item.shortLabel || item.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function translateUiProps(value, translateText, parentKey = "") {
  if (typeof value === "string") {
    return SKIP_TRANSLATION_KEYS.has(parentKey) ? value : translateText(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => translateUiProps(item, translateText, parentKey));
  }
  if (!value || typeof value !== "object") return value;
  const next = {};
  for (const [key, child] of Object.entries(value)) {
    next[key] = translateUiProps(child, translateText, key);
  }
  return next;
}
