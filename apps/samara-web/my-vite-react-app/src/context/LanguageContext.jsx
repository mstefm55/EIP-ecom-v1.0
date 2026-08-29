import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import { perfectFitMetadata } from '../config/perfectFitMetadata';
import {
  getPerfectFitLanguages,
  getStoredPerfectFitLocale,
  persistPerfectFitLocale,
  resolvePerfectFitLocale,
  translatePerfectFitKey
} from '../lib/i18n';

const LanguageContext = createContext(null);

export function LanguageProvider({ children, metadata = perfectFitMetadata }) {
  const languages = useMemo(() => getPerfectFitLanguages(metadata), [metadata]);
  const [locale, setLocaleState] = useState(() => getStoredPerfectFitLocale(metadata));

  const setLocale = useCallback(
    (nextLocale) => {
      const resolved = resolvePerfectFitLocale(nextLocale, metadata);
      setLocaleState(resolved);
      persistPerfectFitLocale(resolved, metadata);
    },
    [metadata]
  );

  useEffect(() => {
    const resolved = resolvePerfectFitLocale(locale, metadata);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = resolved;
    }
  }, [locale, metadata]);

  const t = useCallback(
    (key, params = {}, fallback = undefined) =>
      translatePerfectFitKey(
        key,
        params,
        {
          locale,
          fallback
        },
        metadata
      ),
    [locale, metadata]
  );

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
      languages,
      metadata
    }),
    [languages, locale, metadata, setLocale, t]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function usePerfectFitLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error('usePerfectFitLanguage must be used within LanguageProvider');
  }

  return context;
}

export default LanguageContext;
