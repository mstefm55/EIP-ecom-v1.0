import React from "react";
import { fetchBootstrap } from "../lib/authzBootstrap.js";

export const AuthzContext = React.createContext(null);

export function AuthzProvider({ children }) {
  const [state, setState] = React.useState({
    loading: true,
    error: null,
    payload: null
  });

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetchBootstrap();
        if (!alive) return;
        setState({ loading: false, error: null, payload: res.payload });
      } catch (e) {
        if (!alive) return;
        setState({ loading: false, error: String(e?.message || e), payload: null });
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <AuthzContext.Provider value={state}>
      {children}
    </AuthzContext.Provider>
  );
}

export function useAuthz() {
  const v = React.useContext(AuthzContext);
  if (!v) throw new Error("AuthzProvider missing");
  return v;
}
