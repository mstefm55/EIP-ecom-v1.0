export function authCookieBase(app) {
  const isProd = app?.config?.NODE_ENV === "production";
  const crossSite = Boolean(app?.config?.AUTH_COOKIE_CROSS_SITE);

  return {
    path: "/",
    sameSite: crossSite ? "none" : "lax",
    secure: crossSite || isProd
  };
}
