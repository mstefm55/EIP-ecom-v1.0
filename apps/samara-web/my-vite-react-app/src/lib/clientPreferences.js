/**
 * Browser-local UI/session preferences.
 * These values are explicitly NOT business authority and do not need to move
 * into EIP unless a later product decision requires cross-device preferences.
 */
const storage = () => (typeof window !== 'undefined' ? window.localStorage : null);
const session = () => (typeof window !== 'undefined' ? window.sessionStorage : null);

export const clientPreferences = {
  getItem(key) {
    return storage()?.getItem(key) ?? null;
  },
  setItem(key, value) {
    storage()?.setItem(key, String(value));
  },
  removeItem(key) {
    storage()?.removeItem(key);
  },
  clear() {
    storage()?.clear();
  }
};

export const clientSession = {
  getItem(key) {
    return session()?.getItem(key) ?? null;
  },
  setItem(key, value) {
    session()?.setItem(key, String(value));
  },
  removeItem(key) {
    session()?.removeItem(key);
  },
  clear() {
    session()?.clear();
  }
};
