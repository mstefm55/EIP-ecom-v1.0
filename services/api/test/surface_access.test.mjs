import assert from "node:assert/strict";
import test from "node:test";
import { isAuthenticatedSurfaceAllowed, resolveEipSurfaceAccess } from "../src/lib/surfaceAccess.js";

function buildApp({ ownerTenantCode = "owner", tenantCode = "tenant_a", tenantAttrs = {}, identityAttrs = {} } = {}) {
  return {
    config: { OWNER_TENANT_CODE: ownerTenantCode },
    db: {
      async query() {
        return {
          rowCount: 1,
          rows: [{
            login: "user@example.test",
            identity_attrs: identityAttrs,
            tenant_id: "tenant-1",
            tenant_code: tenantCode,
            tenant_name: tenantCode,
            tenant_attrs: tenantAttrs,
            tenant_logo_url: null
          }]
        };
      }
    }
  };
}

const session = {
  tenant_id: "tenant-1",
  identity_id: "identity-1"
};

test("owner/admin tenant is classified for admin surface only", async () => {
  const access = await resolveEipSurfaceAccess(buildApp({ tenantCode: "owner" }), session);

  assert.equal(access.is_owner_admin_session, true);
  assert.equal(access.default_surface, "admin");
  assert.deepEqual(access.allowed_surfaces, ["admin"]);
  assert.equal(isAuthenticatedSurfaceAllowed("admin", access), true);
  assert.equal(isAuthenticatedSurfaceAllowed("dashboard", access), false);
});

test("normal tenant is classified for dashboard surface only", async () => {
  const access = await resolveEipSurfaceAccess(buildApp({ tenantCode: "tenant_a" }), session);

  assert.equal(access.is_owner_admin_session, false);
  assert.equal(access.default_surface, "dashboard");
  assert.deepEqual(access.allowed_surfaces, ["dashboard"]);
  assert.equal(isAuthenticatedSurfaceAllowed("dashboard", access), true);
  assert.equal(isAuthenticatedSurfaceAllowed("admin", access), false);
});

test("owner/admin tenant kind fallback only applies when owner tenant code is unset", async () => {
  const access = await resolveEipSurfaceAccess(
    buildApp({
      ownerTenantCode: "",
      tenantCode: "platform",
      tenantAttrs: { tenant_kind: "owner_admin" }
    }),
    session
  );

  assert.equal(access.is_owner_admin_session, true);
  assert.equal(access.surface_classification_source, "tenant_kind_fallback");
  assert.equal(access.default_surface, "admin");
});
