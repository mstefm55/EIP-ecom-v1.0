import { sha256Hex } from "../../auth/crypto.js";

function buildRequestHash(rawBody) {
  if (!rawBody) return sha256Hex("");
  if (Buffer.isBuffer(rawBody) || typeof rawBody === "string") {
    return sha256Hex(rawBody);
  }
  return sha256Hex(JSON.stringify(rawBody));
}

async function ensureIdempotency(client, opts) {
  const { tenantId, scope, key, requestHash } = opts;
  if (!key) return { ok: true, skip: true };

  try {
    await client.query(
      `
      INSERT INTO eip_core.idempotency_key
        (tenant_id, scope, key, request_hash, status)
      VALUES
        ($1,$2,$3,$4,'in_progress')
      `,
      [tenantId, scope, key, requestHash]
    );
    return { ok: true, created: true };
  } catch (err) {
    const r = await client.query(
      `
      SELECT request_hash, status, response
      FROM eip_core.idempotency_key
      WHERE tenant_id=$1 AND scope=$2 AND key=$3
      LIMIT 1
      `,
      [tenantId, scope, key]
    );
    if (r.rowCount === 0) return { ok: false, error: "IDEMPOTENCY_LOOKUP_FAILED" };

    const row = r.rows[0];
    if (row.request_hash !== requestHash) {
      return { ok: false, error: "IDEMPOTENCY_CONFLICT" };
    }
    return {
      ok: true,
      replay: true,
      response: row.response || null,
      status: row.status || null
    };
  }
}

async function finalizeIdempotency(client, opts) {
  const { tenantId, scope, key, response, status } = opts;
  if (!key) return;
  await client.query(
    `
    UPDATE eip_core.idempotency_key
    SET response=$4::jsonb,
        status=$5,
        created_at=created_at
    WHERE tenant_id=$1 AND scope=$2 AND key=$3
    `,
    [tenantId, scope, key, JSON.stringify(response || {}), status || "ok"]
  );
}

export { buildRequestHash, ensureIdempotency, finalizeIdempotency };
