import { resolveConnectionSecretValue } from "./secretStore.js";

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

async function resolveProviderSecret(source, client, tenantId, provider, keyId) {
  const vaultedCodes = [
    keyId ? `provider:${provider}:${keyId}` : null,
    `provider:${provider}`,
    provider
  ].filter(Boolean);
  const vaultedKinds = ["provider.hmac_secret", "webhook.hmac_secret", "verification.hmac_signature.secret"];
  for (const connectionCode of vaultedCodes) {
    for (const kind of vaultedKinds) {
      const secret = await resolveConnectionSecretValue(source, client, { tenantId, connectionCode, kind });
      if (secret) return secret;
    }
  }

  return null;
}

export { resolveTenantByCode, resolveProviderSecret };
