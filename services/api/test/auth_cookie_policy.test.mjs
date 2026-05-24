import assert from "node:assert/strict";
import test from "node:test";
import { authCookieBase, authCookieName, authCookiePrefix } from "../src/lib/authCookies.js";

test("hosted cross-origin auth cookies use SameSite=None and Secure", () => {
  const app = {
    config: {
      NODE_ENV: "production",
      AUTH_COOKIE_CROSS_SITE: true,
      AUTH_COOKIE_PREFIX: ""
    }
  };

  assert.deepEqual(authCookieBase(app), {
    path: "/",
    sameSite: "none",
    secure: true
  });
  assert.equal(authCookiePrefix(app), "__Host-");
  assert.equal(authCookieName(app, "sid"), "__Host-sid");
});

test("local dev auth cookies remain same-site and do not require secure transport", () => {
  const app = {
    config: {
      NODE_ENV: "development",
      AUTH_COOKIE_CROSS_SITE: false,
      AUTH_COOKIE_PREFIX: ""
    }
  };

  assert.deepEqual(authCookieBase(app), {
    path: "/",
    sameSite: "lax",
    secure: false
  });
  assert.equal(authCookiePrefix(app), "");
  assert.equal(authCookieName(app, "csrf"), "csrf");
});
