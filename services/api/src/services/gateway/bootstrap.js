import { hasPermission } from "../../auth/perm.js";

async function getPrimaryAgentId(client, tenantId, identityId) {
  const r = await client.query(
    `
    SELECT agent_id
    FROM eip_auth.auth_identity_agent
    WHERE tenant_id=$1
      AND identity_id=$2
      AND is_primary=true
      AND is_active=true
    LIMIT 1
    `,
    [tenantId, identityId]
  );
  return r.rows[0]?.agent_id ?? null;
}

async function getDeviceTrustState(client, tenantId, identityId, deviceId) {
  if (!deviceId) return null;
  const r = await client.query(
    `
    SELECT trust_state
    FROM eip_auth.auth_device
    WHERE tenant_id=$1
      AND identity_id=$2
      AND device_id=$3
    LIMIT 1
    `,
    [tenantId, identityId, deviceId]
  );
  return r.rows[0]?.trust_state ?? null;
}

async function buildSurfaces(app, tenantId, identityId, opts = {}) {
  const hasAny = async (codes) => {
    for (const code of codes) {
      const ok = await hasPermission(app, tenantId, identityId, code);
      if (ok) return true;
    }
    return false;
  };

  const adminEnabled = Boolean(opts.isSystemAdmin && opts.tenantCode === "eip");

  const erpEnabled = await hasAny([
    "CRM_AGENT_READ",
    "CRM_CASE_READ",
    "CRM_OPPORTUNITY_READ",
    "PROCESS_DEF_READ",
    "PROCESS_INSTANCE_READ"
  ]);

  const partnerEnabled = await hasAny(["PORTAL_ACCESS", "PORTAL_READ"]);
  const ecomEnabled = await hasAny(["ECOM_ACCESS", "ECOM_READ"]);

  return [
    {
      code: "ADMIN",
      label: "Admin",
      capabilities: { enabled: adminEnabled },
      nav: adminEnabled ? [{ code: "tenant-requests", label: "Tenant Requests" }] : []
    },
    {
      code: "ERP",
      label: "ERP",
      capabilities: { enabled: erpEnabled },
      nav: erpEnabled ? [{ code: "crm", label: "CRM" }, { code: "process", label: "Processes" }] : []
    },
    {
      code: "PARTNER",
      label: "Partner",
      capabilities: { enabled: partnerEnabled },
      nav: partnerEnabled ? [{ code: "portal", label: "Portal" }] : []
    },
    {
      code: "ECOM",
      label: "eCom",
      capabilities: { enabled: ecomEnabled },
      nav: ecomEnabled ? [{ code: "shop", label: "Shop" }] : []
    }
  ];
}

async function buildBootstrapPayload(app, session) {
  const tenantId = session.tenant_id;
  const identityId = session.identity_id;

  const tenantRes = await app.db.query(
    `
    SELECT id, code
    FROM eip_core.tenant
    WHERE id=$1
    `,
    [tenantId]
  );
  const tenantRow = tenantRes.rows[0] || { id: tenantId, code: null };

  const identityRes = await app.db.query(
    `
    SELECT attrs
    FROM eip_auth.auth_identity
    WHERE tenant_id=$1 AND id=$2
    `,
    [tenantId, identityId]
  );
  const identityAttrs = identityRes.rows[0]?.attrs || {};
  const isSystemAdmin = identityAttrs?.system_admin === true;

  const agentId = await getPrimaryAgentId(app.db, tenantId, identityId);
  const trustState = await getDeviceTrustState(
    app.db,
    tenantId,
    identityId,
    session.device_id
  );

  const surfaces = await buildSurfaces(app, tenantId, identityId, {
    tenantCode: tenantRow.code,
    isSystemAdmin,
  });

  return {
    ok: true,
    version: 1,
    tenant: { id: tenantRow.id, code: tenantRow.code || null },
    actor: { identity_id: identityId, agent_id: agentId },
    device: { id: session.device_id || null, trust_state: trustState },
    surfaces
  };
}

export { buildBootstrapPayload };
