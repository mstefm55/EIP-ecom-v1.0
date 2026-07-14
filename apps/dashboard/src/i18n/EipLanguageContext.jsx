import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  EIP_LANGUAGE_OPTIONS,
  getEipLanguageMetadata,
  normalizeEipLocale,
  translateEipText,
} from "./eipLanguageLibrary";

const STORAGE_KEY = "eip.dashboard.language";
const EipLanguageContext = createContext(null);
const TRANSLATABLE_ATTRIBUTES = Object.freeze([
  "title",
  "aria-label",
  "aria-description",
  "placeholder",
  "alt",
  "data-title",
  "data-tooltip",
]);
const SKIP_SUBTREE_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "CODE",
  "PRE",
  "SVG",
  "CANVAS",
]);
const SKIP_TEXT_TAGS = new Set([...SKIP_SUBTREE_TAGS, "TEXTAREA"]);

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

function preserveWhitespace(original, translated) {
  const leading = String(original || "").match(/^\s*/)?.[0] || "";
  const trailing = String(original || "").match(/\s*$/)?.[0] || "";
  return `${leading}${translated}${trailing}`;
}

function isSkippableElement(element) {
  if (!element || element.nodeType !== 1) return false;
  if (SKIP_SUBTREE_TAGS.has(element.tagName)) return true;
  if (element.closest?.("[data-eip-i18n='off'], [translate='no'], [contenteditable='true']")) {
    return true;
  }
  return false;
}

function isSkippableTextNode(node) {
  const parent = node?.parentElement;
  return !parent || SKIP_TEXT_TAGS.has(parent.tagName) || isSkippableElement(parent);
}

export function EipLanguageProvider({ children }) {
  const [language, setLanguageState] = useState(safeReadStoredLanguage);
  const textOriginalsRef = useRef(new WeakMap());
  const attrOriginalsRef = useRef(new WeakMap());
  const translatedTextMutationsRef = useRef(new WeakSet());
  const translatedAttributeMutationsRef = useRef(new WeakMap());
  const applyingDomTranslationRef = useRef(false);

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

  useEffect(() => {
    if (typeof document === "undefined" || typeof MutationObserver === "undefined") return undefined;
    const root = document.getElementById("root") || document.body;
    if (!root) return undefined;

    const translateTextNode = (node) => {
      if (!node || node.nodeType !== 3 || isSkippableTextNode(node)) return;
      if (!textOriginalsRef.current.has(node)) {
        textOriginalsRef.current.set(node, node.nodeValue || "");
      }
      const original = textOriginalsRef.current.get(node) || "";
      const trimmed = original.trim();
      if (!trimmed || trimmed.length < 2) {
        node.nodeValue = original;
        return;
      }
      const translated = t(trimmed);
      const nextValue = translated && translated !== trimmed
        ? preserveWhitespace(original, translated)
        : original;
      if (node.nodeValue !== nextValue) {
        translatedTextMutationsRef.current.add(node);
        node.nodeValue = nextValue;
      }
    };

    const translateElementAttributes = (element) => {
      if (!element || element.nodeType !== 1 || isSkippableElement(element)) return;
      let originals = attrOriginalsRef.current.get(element);
      if (!originals) {
        originals = new Map();
        attrOriginalsRef.current.set(element, originals);
      }
      for (const attr of TRANSLATABLE_ATTRIBUTES) {
        if (!element.hasAttribute(attr)) continue;
        if (!originals.has(attr)) originals.set(attr, element.getAttribute(attr) || "");
        const original = originals.get(attr) || "";
        const trimmed = original.trim();
        if (!trimmed || trimmed.length < 2) {
          element.setAttribute(attr, original);
          continue;
        }
        const translated = t(trimmed);
        const nextValue = translated && translated !== trimmed ? translated : original;
        if (element.getAttribute(attr) !== nextValue) {
          let translatedAttrs = translatedAttributeMutationsRef.current.get(element);
          if (!translatedAttrs) {
            translatedAttrs = new Set();
            translatedAttributeMutationsRef.current.set(element, translatedAttrs);
          }
          translatedAttrs.add(attr);
          element.setAttribute(attr, nextValue);
        }
      }
    };

    const applyNode = (node) => {
      if (!node) return;
      if (node.nodeType === 3) {
        translateTextNode(node);
        return;
      }
      if (node.nodeType !== 1 || isSkippableElement(node)) return;
      translateElementAttributes(node);
      const walker = document.createTreeWalker(
        node,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
        {
          acceptNode(candidate) {
            if (candidate.nodeType === 1 && isSkippableElement(candidate)) {
              return NodeFilter.FILTER_REJECT;
            }
            if (candidate.nodeType === 3 && isSkippableTextNode(candidate)) {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          },
        }
      );
      let current = walker.nextNode();
      while (current) {
        if (current.nodeType === 3) translateTextNode(current);
        if (current.nodeType === 1) translateElementAttributes(current);
        current = walker.nextNode();
      }
    };

    const applyAll = () => {
      applyingDomTranslationRef.current = true;
      try {
        applyNode(root);
      } finally {
        applyingDomTranslationRef.current = false;
      }
    };

    let frame = 0;
    const scheduleApply = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        applyAll();
      });
    };

    applyAll();

    const observer = new MutationObserver((mutations) => {
      if (applyingDomTranslationRef.current) return;
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          if (translatedTextMutationsRef.current.has(mutation.target)) {
            translatedTextMutationsRef.current.delete(mutation.target);
          } else {
            textOriginalsRef.current.delete(mutation.target);
          }
        } else if (mutation.type === "attributes") {
          const translatedAttrs = translatedAttributeMutationsRef.current.get(mutation.target);
          if (translatedAttrs?.has(mutation.attributeName)) {
            translatedAttrs.delete(mutation.attributeName);
          } else {
            const originals = attrOriginalsRef.current.get(mutation.target);
            originals?.delete(mutation.attributeName);
          }
        }
      }
      scheduleApply();
    });
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRIBUTES,
    });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [language, t]);

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
