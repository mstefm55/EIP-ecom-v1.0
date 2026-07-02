import crypto from "node:crypto";
import { SECRET_FIELD_SPECS } from "./connectionProfile.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function resolveConfig(source = {}) {
  return source?.config || source || {};
}

function getEncryptionKey(source = {}) {
  const config = resolveConfig(source);
  const raw = normalizeText(config.SECRET_ENCRYPTION_KEY || process.env.SECRET_ENCRYPTION_KEY);
  if (!raw) throw new Error("SECRET_ENCRYPTION_KEY_REQUIRED");

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  try {
    const decoded = Buffer.from(raw, "base64");
    if (decoded.length === 32) return decoded;
  } catch {
    // Fall through to UTF-8 handling.
  }

  const utf8 = Buffer.from(raw, "utf8");
  if (utf8.length === 32) return utf8;
  throw new Error("SECRET_ENCRYPTION_KEY_INVALID");
}

function getKeyId(source = {}) {
  const config = resolveConfig(source);
  return normalizeText(config.SECRET_ENCRYPTION_KEY_ID || process.env.SECRET_ENCRYPTION_KEY_ID || "default") || "default";
}

function getApiKeyPepper(source = {}) {
  const config = resolveConfig(source);
  const pepper = normalizeText(config.API_KEY_PEPPER || process.env.API_KEY_PEPPER);
  if (!pepper) throw new Error("API_KEY_PEPPER_REQUIRED");
  return pepper;
}

function isHashOnlySecretKind(kind) {
  return normalizeText(kind) === "verification.api_key.secret";
}

function hashConnectionApiKey(source, plaintext) {
  return crypto
    .createHash("sha256")
    .update(`${String(plaintext)}:${getApiKeyPepper(source)}`)
    .digest("hex");
}

function refKeyName(key) {
  return `${key}_ref`;
}

function setKeyName(key) {
  return `${key}_set`;
}

function versionKeyName(key) {
  return `${key}_version`;
}

function rotatedAtKeyName(key) {
  return `${key}_last_rotated_at`;
}

function rotatedByKeyName(key) {
  return `${key}_rotated_by`;
}

function statusKeyName(key) {
  return `${key}_status`;
}

function getNested(obj, path) {
  return path.reduce((acc, key) => (acc && typeof acc === "object" ? acc[key] : undefined), obj);
}

function deleteSecretValue(target, key) {
  if (!target || typeof target !== "object") return;
  delete target[key];
}

function applySecretReference(target, key, row) {
  deleteSecretValue(target, key);
  target[refKeyName(key)] = row.id;
  target[setKeyName(key)] = true;
  target[versionKeyName(key)] = row.version;
  target[rotatedAtKeyName(key)] = row.rotated_at || row.created_at || null;
  target[rotatedByKeyName(key)] = row.rotated_by || null;
  target[statusKeyName(key)] = row.status || "active";
}

function clearSecretReference(target, key) {
  deleteSecretValue(target, key);
  delete target[refKeyName(key)];
  target[setKeyName(key)] = false;
  delete target[versionKeyName(key)];
  delete target[rotatedAtKeyName(key)];
  delete target[rotatedByKeyName(key)];
  target[statusKeyName(key)] = "revoked";
}

function profileHasSecretRefs(profile) {
  return SECRET_FIELD_SPECS.some((spec) => {
    const target = getNested(profile, spec.path);
    return Boolean(target && typeof target === "object" && normalizeText(target[refKeyName(spec.key)]));
  });
}

function buildAad({ tenantId, connectionCode, kind, version }) {
  return `${tenantId}:${connectionCode}:${kind}:v${version}`;
}

function encryptSecret(source, plaintext, aad) {
  const key = getEncryptionKey(source);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    algorithm: "aes-256-gcm",
    key_id: getKeyId(source),
    iv: iv.toString("base64url"),
    tag: tag.toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
    aad
  };
}

function decryptSecret(source, row) {
  const key = getEncryptionKey(source);
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(row.iv, "base64url")
  );
  decipher.setAAD(Buffer.from(row.aad || "", "utf8"));
  decipher.setAuthTag(Buffer.from(row.tag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(row.ciphertext, "base64url")),
    decipher.final()
  ]);
  return plaintext.toString("utf8");
}

function fingerprintSecret(source, plaintext) {
  const key = getEncryptionKey(source);
  return crypto.createHmac("sha256", key).update(String(plaintext)).digest("hex");
}

async function loadActiveSecret(client, tenantId, connectionCode, kind) {
  const r = await client.query(
    `
    SELECT *
    FROM eip_core.connection_secret
    WHERE tenant_id = $1::uuid
      AND connection_code = $2
      AND secret_kind = $3
      AND status = 'active'
    ORDER BY version DESC
    LIMIT 1
    `,
    [tenantId, connectionCode, kind]
  );
  return r.rows[0] || null;
}

async function nextSecretVersion(client, tenantId, connectionCode, kind) {
  const r = await client.query(
    `
    SELECT COALESCE(max(version), 0)::int + 1 AS next_version
    FROM eip_core.connection_secret
    WHERE tenant_id = $1::uuid
      AND connection_code = $2
      AND secret_kind = $3
    `,
    [tenantId, connectionCode, kind]
  );
  return Number(r.rows[0]?.next_version || 1);
}

async function rotateConnectionSecret(source, client, opts) {
  const tenantId = opts.tenantId;
  const connectionCode = normalizeText(opts.connectionCode);
  const kind = normalizeText(opts.kind);
  const plaintext = String(opts.plaintext || "");
  if (!tenantId || !connectionCode || !kind || !plaintext) {
    throw new Error("CONNECTION_SECRET_INPUT_REQUIRED");
  }

  const hashOnly = isHashOnlySecretKind(kind);
  const fingerprint = hashOnly
    ? hashConnectionApiKey(source, plaintext)
    : fingerprintSecret(source, plaintext);
  const existing = await loadActiveSecret(client, tenantId, connectionCode, kind);
  if (existing?.fingerprint === fingerprint) {
    return existing;
  }

  const version = await nextSecretVersion(client, tenantId, connectionCode, kind);
  const aad = buildAad({ tenantId, connectionCode, kind, version });
  const encrypted = hashOnly
    ? {
        algorithm: "sha256-peppered",
        key_id: "api-key-pepper",
        iv: "",
        tag: "",
        ciphertext: fingerprint,
        aad
      }
    : encryptSecret(source, plaintext, aad);

  if (existing) {
    await client.query(
      `
      UPDATE eip_core.connection_secret
      SET status = 'superseded',
          updated_at = now()
      WHERE id = $1::uuid
      `,
      [existing.id]
    );
  }

  const r = await client.query(
    `
    INSERT INTO eip_core.connection_secret
      (tenant_id, connection_code, secret_kind, version, status,
       algorithm, key_id, iv, tag, ciphertext, aad, fingerprint,
       rotated_from, rotated_by, attrs)
    VALUES
      ($1::uuid, $2, $3, $4, 'active',
       $5, $6, $7, $8, $9, $10, $11,
       $12::uuid, $13::uuid, $14::jsonb)
    RETURNING *
    `,
    [
      tenantId,
      connectionCode,
      kind,
      version,
      encrypted.algorithm,
      encrypted.key_id,
      encrypted.iv,
      encrypted.tag,
      encrypted.ciphertext,
      encrypted.aad,
      fingerprint,
      existing?.id || null,
      opts.actorIdentityId || null,
      JSON.stringify(opts.attrs || {})
    ]
  );
  return r.rows[0];
}

async function vaultConnectionProfileSecrets(source, client, tenantId, profiles, actorIdentityId = null) {
  const output = JSON.parse(JSON.stringify(Array.isArray(profiles) ? profiles : []));
  for (const profile of output) {
    const connectionCode = normalizeText(profile?.identity?.connection_code);
    if (!connectionCode) continue;

    for (const spec of SECRET_FIELD_SPECS) {
      const target = getNested(profile, spec.path);
      if (!target || typeof target !== "object") continue;
      const raw = normalizeText(target[spec.key]);
      if (raw) {
        const row = await rotateConnectionSecret(source, client, {
          tenantId,
          connectionCode,
          kind: spec.kind,
          plaintext: raw,
          actorIdentityId,
          attrs: { profile_id: profile.id || null }
        });
        applySecretReference(target, spec.key, row);
      } else {
        deleteSecretValue(target, spec.key);
        if (target[refKeyName(spec.key)]) {
          target[setKeyName(spec.key)] = true;
        }
      }
    }
  }
  return output;
}

async function hydrateConnectionProfileSecrets(source, client, tenantId, profile) {
  const hydrated = JSON.parse(JSON.stringify(profile || {}));
  const connectionCode = normalizeText(hydrated?.identity?.connection_code);
  if (!tenantId || !connectionCode) return hydrated;

  let r;
  try {
    r = await client.query(
      `
      SELECT *
      FROM eip_core.connection_secret
      WHERE tenant_id = $1::uuid
        AND connection_code = $2
        AND status = 'active'
      `,
      [tenantId, connectionCode]
    );
  } catch (error) {
    if (error?.code === "42P01" && !profileHasSecretRefs(hydrated)) return hydrated;
    throw error;
  }
  const byKind = new Map((r.rows || []).map((row) => [row.secret_kind, row]));

  for (const spec of SECRET_FIELD_SPECS) {
    const target = getNested(hydrated, spec.path);
    if (!target || typeof target !== "object") continue;
    const row = byKind.get(spec.kind);
    if (!row) continue;
    applySecretReference(target, spec.key, row);
    if (isHashOnlySecretKind(spec.kind)) {
      if (row.algorithm === "sha256-peppered") {
        target[`${spec.key}_hash`] = row.ciphertext;
        target[`${spec.key}_hash_algorithm`] = row.algorithm;
      } else {
        const legacyPlaintext = decryptSecret(source, row);
        target[`${spec.key}_hash`] = hashConnectionApiKey(source, legacyPlaintext);
        target[`${spec.key}_hash_algorithm`] = "sha256-peppered";
        target[`${spec.key}_migration_required`] = true;
      }
      continue;
    }
    const plaintext = decryptSecret(source, row);
    target[spec.key] = plaintext;
  }

  return hydrated;
}

async function resolveConnectionSecretValue(source, client, opts) {
  const tenantId = opts?.tenantId;
  const connectionCode = normalizeText(opts?.connectionCode);
  const kind = normalizeText(opts?.kind);
  if (!tenantId || !connectionCode || !kind) return null;
  if (isHashOnlySecretKind(kind)) return null;

  try {
    const row = await loadActiveSecret(client, tenantId, connectionCode, kind);
    return row ? decryptSecret(source, row) : null;
  } catch (error) {
    if (error?.code === "42P01") return null;
    throw error;
  }
}

async function migrateLegacyConnectionApiKeyHash(source, client, tenantId, connectionCode, actorIdentityId = null) {
  const kind = "verification.api_key.secret";
  const existing = await loadActiveSecret(client, tenantId, connectionCode, kind);
  if (!existing || existing.algorithm === "sha256-peppered") return existing;
  const plaintext = decryptSecret(source, existing);
  return rotateConnectionSecret(source, client, {
    tenantId,
    connectionCode,
    kind,
    plaintext,
    actorIdentityId,
    attrs: { ...(existing.attrs || {}), migrated_from_algorithm: existing.algorithm }
  });
}

async function syncConnectionProfileSecretReferences(client, tenantId, profile) {
  const output = JSON.parse(JSON.stringify(profile || {}));
  const connectionCode = normalizeText(output?.identity?.connection_code);
  if (!tenantId || !connectionCode) return output;
  const r = await client.query(
    `
    SELECT *
    FROM eip_core.connection_secret
    WHERE tenant_id = $1::uuid
      AND connection_code = $2
      AND status = 'active'
    `,
    [tenantId, connectionCode]
  );
  const byKind = new Map((r.rows || []).map((row) => [row.secret_kind, row]));
  for (const spec of SECRET_FIELD_SPECS) {
    const target = getNested(output, spec.path);
    const row = byKind.get(spec.kind);
    if (!target || typeof target !== "object" || !row) continue;
    applySecretReference(target, spec.key, row);
    delete target[`${spec.key}_hash`];
    delete target[`${spec.key}_hash_algorithm`];
    delete target[`${spec.key}_migration_required`];
  }
  return output;
}

async function revokeConnectionSecrets(client, opts) {
  const tenantId = opts.tenantId;
  const connectionCode = normalizeText(opts.connectionCode);
  const kinds = Array.isArray(opts.kinds) && opts.kinds.length
    ? opts.kinds.map(normalizeText).filter(Boolean)
    : SECRET_FIELD_SPECS.map((spec) => spec.kind);
  if (!tenantId || !connectionCode || !kinds.length) {
    throw new Error("CONNECTION_SECRET_REVOKE_INPUT_REQUIRED");
  }

  const r = await client.query(
    `
    UPDATE eip_core.connection_secret
    SET status = 'revoked',
        revoked_at = now(),
        revoked_by = $4::uuid,
        updated_at = now()
    WHERE tenant_id = $1::uuid
      AND connection_code = $2
      AND secret_kind = ANY($3::text[])
      AND status = 'active'
    RETURNING *
    `,
    [tenantId, connectionCode, kinds, opts.actorIdentityId || null]
  );
  return r.rows || [];
}

function clearProfileSecretRefs(profiles, connectionCode, kinds) {
  const next = JSON.parse(JSON.stringify(Array.isArray(profiles) ? profiles : []));
  const kindSet = new Set(kinds);
  for (const profile of next) {
    if (normalizeText(profile?.identity?.connection_code) !== connectionCode) continue;
    for (const spec of SECRET_FIELD_SPECS) {
      if (!kindSet.has(spec.kind)) continue;
      const target = getNested(profile, spec.path);
      if (target && typeof target === "object") clearSecretReference(target, spec.key);
    }
  }
  return next;
}

export {
  SECRET_FIELD_SPECS,
  clearProfileSecretRefs,
  decryptSecret,
  encryptSecret,
  hydrateConnectionProfileSecrets,
  hashConnectionApiKey,
  migrateLegacyConnectionApiKeyHash,
  revokeConnectionSecrets,
  resolveConnectionSecretValue,
  rotateConnectionSecret,
  syncConnectionProfileSecretReferences,
  vaultConnectionProfileSecrets
};
