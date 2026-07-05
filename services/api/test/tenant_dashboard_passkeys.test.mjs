import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(apiRoot, "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.resolve(repoRoot, relativePath), "utf8");
}

const dashboardSurface = read("apps/dashboard/src/engine/surfaces/dashboard.js");
const dashboardSeed = read("services/api/db/seed/ui_surface_dashboard.sql");
const dashboardMigration = read("services/api/db/migrations/0136_tenant_dashboard_passkeys.sql");
const registry = read("apps/dashboard/src/engine/registry.jsx");
const userSecurity = read("apps/dashboard/src/components/user/UserSecurityPanel.jsx");
const loginCard = read("apps/dashboard/src/components/auth/AuthLoginCard.jsx");
const authRoutes = read("services/api/src/routes/auth.js");

test("tenant dashboard exposes self-service passkey security in fallback and governed surfaces", () => {
  for (const source of [dashboardSurface, dashboardSeed]) {
    assert.match(source, /"?code"?:\s*"security"/);
    assert.match(source, /"?type"?:\s*"UserSecurityPanel"/);
    assert.match(source, /"?tab"?:\s*"security"/);
  }
  assert.match(registry, /UserSecurityPanel/);
  assert.match(userSecurity, /instead of requesting an email OTP/);
});

test("migration patches every active published dashboard surface idempotently", () => {
  assert.match(dashboardMigration, /ui_surface\.code = 'dashboard'/);
  assert.match(dashboardMigration, /is_active = true/);
  assert.match(dashboardMigration, /is_published = true/);
  assert.match(dashboardMigration, /entry->>'code' <> 'security'/);
  assert.match(dashboardMigration, /entry->>'id' <> 'user-security-panel'/);
  assert.match(dashboardMigration, /tenant_passkeys_v1/);
});

test("tenant passkeys support enrollment, sign-in, listing, step-up, and revocation", () => {
  assert.match(authRoutes, /app\.get\("\/auth\/passkeys"/);
  assert.match(authRoutes, /app\.post\("\/auth\/passkeys\/register\/options"/);
  assert.match(authRoutes, /app\.post\("\/auth\/passkeys\/register\/verify"/);
  assert.match(authRoutes, /app\.post\("\/auth\/passkeys\/login\/options"/);
  assert.match(authRoutes, /app\.post\("\/auth\/passkeys\/login\/verify"/);
  assert.match(authRoutes, /app\.post\("\/auth\/passkeys\/step-up\/options"/);
  assert.match(authRoutes, /app\.post\("\/auth\/passkeys\/:passkeyId\/revoke"/);
  assert.match(loginCard, /passkeyLoginAction = "Use passkey"/);
  assert.match(loginCard, /passkey-login/);
});

test("passkey enrollment remains protected by session, CSRF, and recent step-up", () => {
  const registrationOptions = authRoutes.slice(
    authRoutes.indexOf('app.post("/auth/passkeys/register/options"'),
    authRoutes.indexOf('app.post("/auth/passkeys/register/verify"')
  );
  assert.match(registrationOptions, /requireSession/);
  assert.match(registrationOptions, /requireCsrf/);
  assert.match(registrationOptions, /requireStepUp/);
});
