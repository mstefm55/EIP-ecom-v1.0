function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeSurfaceCode(value) {
  return normalizeText(value).toLowerCase();
}

export async function resolveEipSurfaceAccess(app, session) {
  const r = await app.db.query(
    `
    SELECT
      i.login,
      COALESCE(i.attrs, '{}'::jsonb) AS identity_attrs,
      t.id AS tenant_id,
      t.code AS tenant_code,
      t.name AS tenant_name,
      COALESCE(t.attrs, '{}'::jsonb) AS tenant_attrs,
      COALESCE(
        t.attrs->'branding'->>'logo_url',
        t.attrs->'branding'->>'logo',
        t.attrs->>'logo_url',
        t.attrs->>'logo',
        t.attrs->>'brand_logo_url'
      ) AS tenant_logo_url
    FROM eip_auth.auth_identity i
    JOIN eip_core.tenant t ON t.id = i.tenant_id
    WHERE i.tenant_id = $1 AND i.id = $2
    LIMIT 1
    `,
    [session.tenant_id, session.identity_id]
  );

  const row = r.rows[0] || {};
  const tenantCode = normalizeText(row.tenant_code);
  const ownerTenantCode = normalizeText(app.config.OWNER_TENANT_CODE);
  const ownerTenantConfigured = Boolean(ownerTenantCode);
  const identityAttrs = row.identity_attrs || {};
  const tenantAttrs = row.tenant_attrs || {};
  const isSystemAdmin = identityAttrs?.system_admin === true;
  const tenantKind = normalizeText(tenantAttrs?.tenant_kind).toLowerCase();
  const matchesConfiguredOwner =
    ownerTenantConfigured && tenantCode.toLowerCase() === ownerTenantCode.toLowerCase();
  const matchesOwnerKindFallback =
    !ownerTenantConfigured && tenantKind === "owner_admin";
  const isOwnerAdminSession = Boolean(matchesConfiguredOwner || matchesOwnerKindFallback);
  const allowedSurfaces = isOwnerAdminSession ? ["admin"] : ["dashboard"];
  const defaultSurface = allowedSurfaces[0];

  return {
    tenant_id: row.tenant_id || session.tenant_id,
    tenant_code: tenantCode || null,
    tenant_name: row.tenant_name || null,
    tenant_logo_url: row.tenant_logo_url || null,
    identity_id: session.identity_id,
    login: row.login ?? null,
    is_system_admin: isSystemAdmin,
    is_owner_admin_session: isOwnerAdminSession,
    surface_classification: isOwnerAdminSession ? "owner-admin" : "tenant",
    surface_classification_source: matchesConfiguredOwner
      ? "owner_tenant_code"
      : matchesOwnerKindFallback
        ? "tenant_kind_fallback"
        : "tenant",
    owner_tenant_code_configured: ownerTenantConfigured,
    allowed_surfaces: allowedSurfaces,
    default_surface: defaultSurface,
  };
}

export function isAuthenticatedSurfaceAllowed(code, accessCtx) {
  const normalized = normalizeSurfaceCode(code);
  if (!normalized || normalized === "auth") return false;
  return Array.isArray(accessCtx?.allowed_surfaces)
    && accessCtx.allowed_surfaces.map(normalizeSurfaceCode).includes(normalized);
}
