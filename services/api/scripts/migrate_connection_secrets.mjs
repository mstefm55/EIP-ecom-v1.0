import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import { vaultConnectionProfileSecrets } from "../src/services/gateway/secretStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(apiRoot, "../..");

function parseDotEnv(content) {
  const out = {};
  for (const rawLine of String(content || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

async function loadEnvFallback() {
  const envPath = path.join(repoRoot, ".env");
  try {
    const parsed = parseDotEnv(await fs.readFile(envPath, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      process.env[key] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function buildDbConfig() {
  return {
    host: requiredEnv("DB_HOST"),
    port: Number(process.env.DB_PORT || 5432),
    user: requiredEnv("DB_USER"),
    password: requiredEnv("DB_PASSWORD"),
    database: requiredEnv("DB_DATABASE")
  };
}

function profileList(attrs) {
  return Array.isArray(attrs?.connection_profiles) ? attrs.connection_profiles : [];
}

async function run() {
  await loadEnvFallback();
  requiredEnv("SECRET_ENCRYPTION_KEY");

  const client = new Client(buildDbConfig());
  await client.connect();

  try {
    await client.query("BEGIN");
    const tenants = await client.query(
      `
      SELECT id, code, attrs
      FROM eip_core.tenant
      WHERE jsonb_typeof(attrs->'connection_profiles') = 'array'
      ORDER BY code
      FOR UPDATE
      `
    );

    let tenantsUpdated = 0;
    let profilesChecked = 0;
    const actorIdentityId = process.env.SECRET_MIGRATION_ACTOR_ID || null;

    for (const tenant of tenants.rows) {
      const profiles = profileList(tenant.attrs);
      profilesChecked += profiles.length;
      const vaulted = await vaultConnectionProfileSecrets(
        process.env,
        client,
        tenant.id,
        profiles,
        actorIdentityId
      );
      if (JSON.stringify(vaulted) === JSON.stringify(profiles)) continue;

      await client.query(
        `
        UPDATE eip_core.tenant
        SET attrs = jsonb_set(COALESCE(attrs,'{}'::jsonb), '{connection_profiles}', $2::jsonb, true),
            updated_at = now()
        WHERE id = $1::uuid
        `,
        [tenant.id, JSON.stringify(vaulted)]
      );
      tenantsUpdated += 1;
    }

    await client.query("COMMIT");
    console.log(`Connection secret migration complete: ${tenantsUpdated} tenant(s) updated, ${profilesChecked} profile(s) checked.`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(`Connection secret migration failed: ${error?.message || error}`);
  process.exit(1);
});
