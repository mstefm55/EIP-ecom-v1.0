export function authCookieBase(app) {
  const isProd = app?.config?.NODE_ENV === "production";
  const crossSite = Boolean(app?.config?.AUTH_COOKIE_CROSS_SITE);
  const secure = crossSite || isProd;

  return {
    path: "/",
    sameSite: crossSite ? "none" : "lax",
    secure
  };
}

export function authCookiePrefix(app) {
  const base = authCookieBase(app);
  const configured = String(app?.config?.AUTH_COOKIE_PREFIX || "").trim();
  const prefix = configured || (base.secure && app?.config?.NODE_ENV === "production" ? "__Host-" : "");
  if (!prefix) return "";
  if (prefix === "__Host-") return base.secure ? "__Host-" : "";
  return /^[A-Za-z0-9_-]{1,24}-$/.test(prefix) ? prefix : "";
}

export function authCookieName(app, logicalName) {
  return `${authCookiePrefix(app)}${logicalName}`;
}

export function getAuthCookie(req, app, logicalName) {
  const primary = authCookieName(app, logicalName);
  return req.cookies?.[primary] || req.cookies?.[logicalName] || null;
}

export function setAuthCookie(reply, app, logicalName, value, options = {}) {
  return reply.setCookie(authCookieName(app, logicalName), value, {
    ...authCookieBase(app),
    ...options
  });
}

export function clearAuthCookie(reply, app, logicalName, options = {}) {
  const clearOptions = {
    ...authCookieBase(app),
    ...options
  };
  reply.clearCookie(authCookieName(app, logicalName), clearOptions);
  if (authCookieName(app, logicalName) !== logicalName) {
    reply.clearCookie(logicalName, clearOptions);
  }
}

export function sessionTtlMs(app) {
  const hours = Number(app?.config?.SESSION_ABSOLUTE_TTL_HOURS || 8);
  const safeHours = Number.isFinite(hours) && hours > 0 ? Math.min(hours, 24) : 8;
  return safeHours * 60 * 60 * 1000;
}

export function deviceCookieTtlMs(app) {
  const days = Number(app?.config?.DEVICE_COOKIE_TTL_DAYS || 14);
  const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 30) : 14;
  return safeDays * 24 * 60 * 60 * 1000;
}
