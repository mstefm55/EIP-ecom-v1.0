// services/api/src/routes/public_commerce_preflight.js
// Connection-aware CORS preflight for public commerce storefront calls.
// This intentionally stays generic: allowed origins come from each EIP connection
// profile, especially identity.frontend_url / identity.portal_url and
// inbound.origin_allowlist. No storefront name or URL is hardcoded here.

import { extractProfiles } from "../services/gateway/connectionProfile.js";
import { connectionAllowsOrigin } from "../services/gateway/verification.js";
import { auditSecurityEvent } from "../lib/securityAudit.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function applyCors(reply, origin, requestHeaders) {
  if (!origin) return;
  reply.header("Access-Control-Allow-Origin", origin);
  reply.header("Vary", "Origin");
  reply.header("Access-Control-Allow-Credentials", "true");
  reply.header(
    "Access-Control-Allow-Headers",
    requestHeaders || "Content-Type, X-API-Key, Authorization, X-Event-Id, X-Member-Csrf"
  );
  reply.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  reply.header("Access-Control-Max-Age", "600");
}

async function resolveTenantBySuffix(app, suffix) {
  const r = await app.db.query(
    `
    SELECT id, code, name, attrs
    FROM eip_core.tenant
    WHERE EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(attrs->'connection_profiles') = 'array'
          THEN attrs->'connection_profiles'
          ELSE '[]'::jsonb
        END
      ) AS profile
      WHERE profile->'inbound'->>'inbound_path_suffix' = $1
    )
    LIMIT 2
    `,
    [suffix]
  );
  if (r.rowCount === 0) return null;
  if (r.rowCount > 1) return { error: "DUPLICATE_SUFFIX" };
  const tenant = r.rows[0];
  const profiles = extractProfiles(tenant.attrs);
  const profile = profiles.find((item) => item?.inbound?.inbound_path_suffix === suffix);
  return { tenant, profile, profiles };
}

export default async function publicCommercePreflightRoutes(app) {
  async function handlePreflight(req, reply) {
    const suffix = normalizeText(req.params?.suffix);
    const origin = normalizeText(req.headers.origin);
    const requestHeaders = req.headers["access-control-request-headers"];

    if (!suffix) {
      return reply.code(400).send({ ok: false, error: "CONNECTION_SUFFIX_REQUIRED" });
    }

    const resolved = await resolveTenantBySuffix(app, suffix);
    if (!resolved || resolved.error || !resolved.profile) {
      await auditSecurityEvent(app, "commerce.preflight_connection_not_found", {
        category: "public_commerce",
        source: "public_commerce_preflight",
        severity: "warning",
        outcome: "rejected",
        suffix,
        reason: resolved?.error || "CONNECTION_NOT_FOUND",
        ip: req.ip,
        userAgent: req.headers["user-agent"] || null,
        metadata: { origin: origin || null }
      });
      return reply.code(resolved?.error ? 409 : 404).send({ ok: false, error: resolved?.error || "CONNECTION_NOT_FOUND" });
    }

    if (!resolved.profile.identity?.is_enabled) {
      return reply.code(403).send({ ok: false, error: "CONNECTION_DISABLED" });
    }

    if (!connectionAllowsOrigin(resolved.profile, origin)) {
      await auditSecurityEvent(app, "commerce.preflight_origin_rejected", {
        category: "public_commerce",
        source: "public_commerce_preflight",
        severity: "warning",
        outcome: "rejected",
        tenantId: resolved.tenant.id,
        connectionCode: resolved.profile.identity?.connection_code,
        suffix,
        reason: "ORIGIN_NOT_ALLOWED",
        ip: req.ip,
        userAgent: req.headers["user-agent"] || null,
        metadata: { origin: origin || null }
      });
      return reply.code(403).send({ ok: false, error: "ORIGIN_NOT_ALLOWED" });
    }

    applyCors(reply, origin, requestHeaders);
    return reply.code(204).send();
  }

  app.options(
    "/commerce/:suffix",
    { config: { cors: false } },
    handlePreflight
  );

  app.options(
    "/commerce/:suffix/*",
    { config: { cors: false } },
    handlePreflight
  );
}
