import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(apiRoot, "../..");
const migrationsDir = path.join(apiRoot, "db", "migrations");

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
    throw new Error(`Missing required database environment variable: ${name}`);
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

async function listMigrationFiles() {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

async function ensureMigrationLedger(client) {
  await client.query("CREATE SCHEMA IF NOT EXISTS eip_core");
  await client.query(`
    CREATE TABLE IF NOT EXISTS eip_core.schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function getAppliedMigrations(client) {
  const result = await client.query(
    "SELECT filename FROM eip_core.schema_migrations ORDER BY filename"
  );
  return new Set(result.rows.map((row) => row.filename));
}

async function run() {
  await loadEnvFallback();

  const files = await listMigrationFiles();
  if (files.length === 0) {
    throw new Error(`No SQL migration files found in ${migrationsDir}`);
  }

  const client = new Client(buildDbConfig());
  await client.connect();

  try {
    await ensureMigrationLedger(client);
    const applied = await getAppliedMigrations(client);

    let appliedCount = 0;
    let skippedCount = 0;

    for (const filename of files) {
      if (applied.has(filename)) {
        console.log(`Skipping ${filename} (already applied)`);
        skippedCount += 1;
        continue;
      }

      console.log(`Applying ${filename}`);
      const sql = await fs.readFile(path.join(migrationsDir, filename), "utf8");
      await client.query(sql);
      await client.query(
        "INSERT INTO eip_core.schema_migrations (filename) VALUES ($1)",
        [filename]
      );
      appliedCount += 1;
    }

    console.log(
      `Migration complete: ${appliedCount} applied, ${skippedCount} skipped, ${files.length} total.`
    );
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(`Migration failed: ${error?.message || error}`);
  process.exit(1);
});
