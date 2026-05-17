import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

function parseDotEnv(content) {
  const out = {};
  for (const rawLine of String(content || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!key) continue;
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
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.resolve(__dirname, "../../../.env");
  const text = await fs.readFile(envPath, "utf8");
  return parseDotEnv(text);
}

function pickCurrencyCode(country) {
  const currencies = country?.currencies;
  if (!currencies || typeof currencies !== "object") return null;
  const keys = Object.keys(currencies)
    .map((item) => String(item || "").trim().toUpperCase())
    .filter((item) => /^[A-Z]{3}$/.test(item))
    .sort((a, b) => a.localeCompare(b));
  return keys[0] || null;
}

async function fetchCountryCurrencies() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch("https://restcountries.com/v3.1/all?fields=cca2,currencies", {
      signal: controller.signal,
      headers: { accept: "application/json" }
    });
    if (!response.ok) {
      throw new Error(`COUNTRY_CURRENCY_SOURCE_FAILED_${response.status}`);
    }
    const payload = await response.json();
    const items = Array.isArray(payload) ? payload : [];
    const map = new Map();
    for (const item of items) {
      const code = String(item?.cca2 || "").trim().toUpperCase();
      const currency = pickCurrencyCode(item);
      if (!/^[A-Z]{2}$/.test(code) || !currency) continue;
      map.set(code, currency);
    }
    return map;
  } finally {
    clearTimeout(timeout);
  }
}

async function run() {
  const fallbackEnv = await loadEnvFallback();
  const config = {
    host: process.env.DB_HOST || fallbackEnv.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || fallbackEnv.DB_PORT || 5432),
    user: process.env.DB_USER || fallbackEnv.DB_USER || "postgres",
    password: process.env.DB_PASSWORD ?? fallbackEnv.DB_PASSWORD ?? "",
    database: process.env.DB_DATABASE || fallbackEnv.DB_DATABASE || "eip"
  };

  const countryCurrencyMap = await fetchCountryCurrencies();
  if (!countryCurrencyMap.size) {
    throw new Error("COUNTRY_CURRENCY_SOURCE_EMPTY");
  }

  const client = new Client(config);
  await client.connect();
  try {
    const existing = await client.query(
      `
      SELECT code, COALESCE(attrs, '{}'::jsonb) AS attrs
      FROM eip_core.jurisdiction
      WHERE tenant_id IS NULL
        AND level = 'COUNTRY'
        AND is_active = true
      ORDER BY code
      `
    );

    let updated = 0;
    let missing = 0;
    await client.query("BEGIN");
    for (const row of existing.rows || []) {
      const code = String(row?.code || "").trim().toUpperCase();
      if (!/^[A-Z]{2}$/.test(code)) continue;
      const currency = countryCurrencyMap.get(code);
      if (!currency) {
        missing += 1;
        continue;
      }
      await client.query(
        `
        UPDATE eip_core.jurisdiction
        SET attrs = COALESCE(attrs, '{}'::jsonb) ||
                    jsonb_build_object(
                      'currency', $2::text,
                      'currency_source', 'restcountries'
                    ),
            updated_at = now()
        WHERE tenant_id IS NULL
          AND level = 'COUNTRY'
          AND code = $1
        `,
        [code, currency]
      );
      updated += 1;
    }
    await client.query("COMMIT");
    console.log(
      JSON.stringify({
        ok: true,
        source: "restcountries",
        country_currency_rows: countryCurrencyMap.size,
        jurisdictions_scanned: existing.rowCount || 0,
        updated,
        missing
      })
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(
    JSON.stringify({
      ok: false,
      error: String(error?.message || error)
    })
  );
  process.exit(1);
});

