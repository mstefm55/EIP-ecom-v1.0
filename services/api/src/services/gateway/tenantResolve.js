async function resolveTenantByCode(client, code) {
  const r = await client.query(
    `
    SELECT id, code, name
    FROM eip_core.tenant
    WHERE code = $1
    LIMIT 1
    `,
    [code]
  );
  return r.rows[0] || null;
}

async function resolveProviderSecret(client, tenantId, provider, keyId) {
  const params = [tenantId, provider];
  const filters = [
    "tenant_id=$1",
    "is_active=true",
    "attrs->>'provider'=$2"
  ];
  if (keyId) {
    params.push(keyId);
    filters.push(`attrs->>'key_id' = $${params.length}`);
  }

  const r = await client.query(
    `
    SELECT attrs
    FROM eip_auth.auth_api_key
    WHERE ${filters.join(" AND ")}
    ORDER BY created_at DESC
    LIMIT 1
    `,
    params
  );
  const attrs = r.rows[0]?.attrs || null;
  if (!attrs) return null;

  const secret = attrs.hmac_secret || attrs.secret || attrs.secret_enc || null;
  return secret ? String(secret) : null;
}

export { resolveTenantByCode, resolveProviderSecret };
