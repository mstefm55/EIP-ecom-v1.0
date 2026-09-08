/**
 * Browser-local UI/session preferences.
 * These values are explicitly NOT business authority and do not need to move
 * into EIP unless a later product decision requires cross-device preferences.
 */
const storage = () => (typeof window !== 'undefined' ? window.localStorage : null);
const session = () => (typeof window !== 'undefined' ? window.sessionStorage : null);

// Historical Perfect Fit builds exposed a separate desktop/mobile application shell.
// The current product uses one responsive shell. Keep the old preference key as a
// compatibility shim so older devices that persisted "mobile" can never re-enter
// the retired MobileAppView branch.
const LEGACY_VIEW_MODE_KEY = 'perfectfit_view_mode';

export const clientPreferences = {
  getItem(key) {
    if (key === LEGACY_VIEW_MODE_KEY) return 'desktop';
    return storage()?.getItem(key) ?? null;
  },
  setItem(key, value) {
    if (key === LEGACY_VIEW_MODE_KEY) {
      storage()?.setItem(key, 'desktop');
      return;
    }
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
