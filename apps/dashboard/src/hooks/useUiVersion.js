import { useCallback, useState } from "react";

const UI_VERSION_KEY = "eip.ui.version";

export function useUiVersion() {
  const [uiVersion, setUiVersion] = useState(() => {
    if (typeof window === "undefined") return "v1";
    return window.localStorage.getItem(UI_VERSION_KEY) === "classic" ? "classic" : "v1";
  });

  const toggleUiVersion = useCallback(() => {
    setUiVersion((current) => {
      const next = current === "v1" ? "classic" : "v1";
      if (typeof window !== "undefined") window.localStorage.setItem(UI_VERSION_KEY, next);
      return next;
    });
  }, []);

  return { uiVersion, toggleUiVersion };
}
