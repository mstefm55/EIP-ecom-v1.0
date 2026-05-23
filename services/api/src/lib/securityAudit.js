const ALLOWED_KEYS = new Set([
  "tenantId",
  "identityId",
  "actorTenantId",
  "actorIdentityId",
  "targetTenantId",
  "targetIdentityId",
  "portfolioId",
  "adminIdentityId",
  "accessLevel",
  "sensitiveAllowed",
  "revokeAll",
  "outcome",
  "reason",
  "ip"
]);

export function auditSecurityEvent(app, action, details = {}) {
  const safe = {};
  for (const [key, value] of Object.entries(details || {})) {
    if (!ALLOWED_KEYS.has(key)) continue;
    if (value === undefined || value === null || value === "") continue;
    safe[key] = value;
  }
  app?.log?.info({
    event: "security_audit",
    action,
    ...safe
  });
}
