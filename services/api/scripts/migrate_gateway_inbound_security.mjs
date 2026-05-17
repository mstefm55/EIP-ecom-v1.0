import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

function loadEnvFromRoot() {
  const root = path.resolve(process.cwd(), "../../..");
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function randomSecret() {
  return crypto.randomBytes(24).toString("base64url");
}

function normalizeText(value) {
  return String(value || "").trim();
}

function isInbound(profile) {
  const dir = profile?.identity?.direction || "inbound";
  return dir === "inbound" || dir === "both";
}

function ensureRateLimit(inbound) {
  if (!inbound.rate_limit) inbound.rate_limit = {};
  if (!Number.isFinite(Number(inbound.rate_limit.max))) inbound.rate_limit.max = 120;
  if (!Number.isFinite(Number(inbound.rate_limit.window_sec))) inbound.rate_limit.window_sec = 60;
}

function migrateProfile(profile) {
  const env = profile?.identity?.environment || "production";
  if (!isInbound(profile) || env === "sandbox") return null;

  const verification = profile.verification || {};
  const allowUnverified = verification.allow_unverified === true;
  const changes = {};

  if (verification.mode === "none" && !allowUnverified) {
    const apiKey = verification.api_key || {};
    apiKey.header_name = apiKey.header_name || "x-api-key";
    apiKey.secret = apiKey.secret || randomSecret();
    profile.verification = {
      ...verification,
      mode: "api_key",
      api_key: apiKey,
      allow_unverified: false
    };
    changes.api_key = apiKey.secret;
  }

  if (verification.mode === "hmac_signature") {
    profile.verification.hmac_signature = {
      ...profile.verification.hmac_signature,
      timestamp_header: profile.verification.hmac_signature?.timestamp_header || "x-timestamp",
      max_skew_sec: Number(profile.verification.hmac_signature?.max_skew_sec || 300)
    };
  }

  if (verification.mode === "oauth2_jwt") {
    profile.verification.oauth2_jwt = {
      ...profile.verification.oauth2_jwt,
      max_skew_sec: Number(profile.verification.oauth2_jwt?.max_skew_sec || 300),
      max_age_sec:
        Number(profile.verification.oauth2_jwt?.max_age_sec || 0) || 900
    };
  }

  if (profile.inbound) ensureRateLimit(profile.inbound);

  return changes.api_key ? { api_key: changes.api_key } : null;
}

async function main() {
  loadEnvFromRoot();

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE
  });

  await client.connect();

  const res = await client.query(
    "SELECT id, code, attrs FROM eip_core.tenant WHERE is_active = true"
  );

  const report = [];

  for (const row of res.rows) {
    const attrs = row.attrs || {};
    const profiles = Array.isArray(attrs.connection_profiles)
      ? attrs.connection_profiles
      : [];
    if (!profiles.length) continue;

    let touched = false;
    const secrets = [];
    const nextProfiles = profiles.map((profile) => {
      const next = JSON.parse(JSON.stringify(profile));
      const change = migrateProfile(next);
      if (change?.api_key) {
        touched = true;
        secrets.push({
          tenant_code: row.code,
          connection_code: normalizeText(next?.identity?.connection_code),
          api_key: change.api_key
        });
      } else if (JSON.stringify(next) !== JSON.stringify(profile)) {
        touched = true;
      }
      return next;
    });

    if (touched) {
      const nextAttrs = { ...attrs, connection_profiles: nextProfiles };
      await client.query(
        "UPDATE eip_core.tenant SET attrs = $2::jsonb, updated_at = now() WHERE id = $1::uuid",
        [row.id, JSON.stringify(nextAttrs)]
      );
      report.push(...secrets);
    }
  }

  await client.end();

  if (report.length) {
    const output = [
      "tenant_code,connection_code,api_key"
    ].concat(report.map((item) => `${item.tenant_code},${item.connection_code},${item.api_key}`));
    const reportDir = path.resolve(process.cwd(), "../reports");
    fs.mkdirSync(reportDir, { recursive: true });
    const filename = path.join(reportDir, `gateway_inbound_secrets_${Date.now()}.csv`);
    fs.writeFileSync(filename, output.join("\n"), "utf8");
    console.log(`Migration complete. Secrets written to: ${filename}`);
    console.log("Secure this file and share secrets with integration owners.");
  } else {
    console.log("Migration complete. No secrets generated.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
