import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
  extractProfiles,
  mergeSecrets,
  normalizeProfile,
  validateProfiles
} from "../src/services/gateway/connectionProfile.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(apiRoot, "../..");
const seedDir = path.join(apiRoot, "db", "seed");

const STAGE_ORDER = [
  "owner-admin",
  "ui-surfaces",
  "process-engine",
  "template-tenant",
  "samara"
];

const EFFECT_TYPES_REQUIRED = [
  "STATUS_SET",
  "TASK_CREATE",
  "TASK_UPDATE",
  "LINK_CREATE",
  "LINK_REMOVE",
  "JSON_MERGE",
  "CHILD_SERVICE_OBJECT_CREATE",
  "INFO_RECORD_WRITE",
  "ACCESS_GRANT_CREATE",
  "INSTANCE_START",
  "HTTP_REQUEST",
  "INVENTORY_MOVE",
  "INVENTORY_CONSUME",
  "INVENTORY_PRODUCE",
  "INVENTORY_CONVERT",
  "VARIANT_INVENTORY_VALIDATE"
];

const TEMPLATE_PROCESS_CODES = [
  "ECOM_PRODUCT_ONBOARDING",
  "ECOM_SALES_ORDER_FLOW",
  "ECOM_RETURN_FLOW",
  "ECOM_REFUND_FLOW",
  "ECOM_PAYMENT_FLOW",
  "ECOM_STOREFRONT_CONTENT_FLOW"
];

const TEMPLATE_BINDING_TYPES = [
  "product",
  "sales_order",
  "return_request",
  "refund_request",
  "payment",
  "storefront_content"
];

const TEMPLATE_TASK_TYPES = [
  "PRODUCT_DRAFT_ENRICH",
  "PRODUCT_QA_REVIEW",
  "ORDER_CONFIRM_TASK",
  "ORDER_FULFILLMENT_TASK",
  "RETURN_REVIEW",
  "RETURN_RECEIVE_TASK",
  "REFUND_REVIEW",
  "REFUND_ISSUE_TASK",
  "PAYMENT_REVIEW",
  "CONTENT_REVIEW"
];

const TEMPLATE_EFFECT_TYPES = [
  "STATUS_SET",
  "JSON_MERGE",
  "CHILD_SERVICE_OBJECT_CREATE",
  "INSTANCE_START",
  "ACCESS_GRANT_CREATE",
  "VARIANT_INVENTORY_VALIDATE"
];

function parseArgs(argv) {
  const out = {
    stages: [],
    list: false,
    recommended: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--list") {
      out.list = true;
      continue;
    }
    if (arg === "--recommended" || arg === "--all") {
      out.recommended = true;
      continue;
    }
    if (arg === "--stage" || arg === "--stages") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        throw new Error(`${arg} requires a stage name`);
      }
      out.stages.push(...splitStages(next));
      i += 1;
      continue;
    }
    if (arg.startsWith("--stage=")) {
      out.stages.push(...splitStages(arg.slice("--stage=".length)));
      continue;
    }
    if (arg.startsWith("--stages=")) {
      out.stages.push(...splitStages(arg.slice("--stages=".length)));
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return out;
}

function splitStages(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function usage() {
  return [
    "Usage:",
    '  OWNER_TENANT_CODE="eip" OWNER_TENANT_NAME="EIP Owner" OWNER_ADMIN_EMAIL="owner@example.com" OWNER_ADMIN_PASSWORD="..." npm run reseed:post-migration -- --stage owner-admin',
    "  npm run reseed:post-migration -- --stage ui-surfaces --stage process-engine --stage template-tenant",
    "  npm run reseed:post-migration -- --stage samara",
    "  npm run reseed:post-migration -- --recommended",
    "",
    `Stages: ${STAGE_ORDER.join(", ")}`
  ].join("\n");
}

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

async function createDbClient() {
  const { Client } = await import("pg");
  return new Client(buildDbConfig());
}

function stripPsqlMetaCommands(sql, filename) {
  let skipped = 0;
  const filtered = String(sql)
    .split(/\r?\n/)
    .filter((line) => {
      if (!line.trimStart().startsWith("\\")) return true;
      skipped += 1;
      return false;
    });

  if (skipped > 0) {
    console.warn(`Skipped ${skipped} psql meta-command line(s) in ${filename}`);
  }

  return filtered.join("\n");
}

function parseBool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return /^(1|true|yes|on)$/i.test(String(value).trim());
}

function parseList(value) {
  return String(value || "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) return normalized;
  }
  return "";
}

function urlOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

function collectMatches(text, regex) {
  const out = new Set();
  let match;
  while ((match = regex.exec(text)) !== null) {
    out.add(match[1]);
  }
  return out;
}

async function runNodeScript(scriptPath, args = [], options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: options.cwd || apiRoot,
      env: process.env,
      stdio: "inherit"
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${path.relative(repoRoot, scriptPath)} failed with ${signal || code}`));
    });
  });
}

async function executeSqlFile(client, filename) {
  const filePath = path.join(seedDir, filename);
  const rawSql = await fs.readFile(filePath, "utf8");
  const sql = stripPsqlMetaCommands(rawSql, filename);
  console.log(`Applying seed ${filename}`);
  await client.query(sql);
}

async function assertTable(client, schemaName, tableName) {
  const result = await client.query(
    `
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = $1
      AND table_name = $2
    LIMIT 1
    `,
    [schemaName, tableName]
  );
  if (result.rowCount === 0) {
    throw new Error(`Missing required table: ${schemaName}.${tableName}. Run npm run migrate first.`);
  }
}

async function tableCount(client, sql, params = []) {
  const result = await client.query(sql, params);
  return Number(result.rows[0]?.count || 0);
}

async function assertEffectTaxonomy(client) {
  const result = await client.query(
    `
    SELECT dv.code
    FROM eip_core.dropdown_list dl
    JOIN eip_core.dropdown_value dv ON dv.list_id = dl.id
    WHERE dl.tenant_id IS NULL
      AND dl.code = 'PROCESS_EFFECT_TYPE'
      AND dl.is_active = true
      AND dv.is_active = true
    `
  );
  const found = new Set(result.rows.map((row) => row.code));
  const missing = EFFECT_TYPES_REQUIRED.filter((code) => !found.has(code));
  if (missing.length > 0) {
    throw new Error(`Missing process effect taxonomy value(s): ${missing.join(", ")}`);
  }
  console.log(`Verified process effect taxonomy: ${EFFECT_TYPES_REQUIRED.length} required values present`);
}

async function assertProcessEngineSourceSupport() {
  const enginePath = path.join(apiRoot, "src", "core", "core_process_engine.js");
  const source = await fs.readFile(enginePath, "utf8");
  const requiredTokens = ["CHILD_SERVICE_OBJECT_CREATE", "childServiceObjectCreate"];
  const missing = requiredTokens.filter((token) => !source.includes(token));
  if (missing.length > 0) {
    throw new Error(`Process engine source is missing child service object support token(s): ${missing.join(", ")}`);
  }
  console.log("Verified process engine child service object support");
}

async function assertSeedProcessAlignment() {
  const processText = [
    await fs.readFile(path.join(seedDir, "template_ecom_process.sql"), "utf8"),
    await fs.readFile(path.join(seedDir, "template_ecom_canonical_v1.sql"), "utf8")
  ].join("\n");
  const uiText = await fs.readFile(path.join(seedDir, "ui_surface_dashboard.sql"), "utf8");

  const processActions = collectMatches(processText, /"action"\s*:\s*"([^"]+)"/g);
  const uiActions = collectMatches(uiText, /"((?:ORDER|RETURN|REFUND|PAYMENT)_[A-Z0-9_]+)"/g);
  const missing = [...uiActions].filter((action) => !processActions.has(action));

  if (missing.length > 0) {
    throw new Error(`Process alignment failed. UI actions missing in process defs: ${missing.sort().join(", ")}`);
  }

  console.log("Verified process alignment: UI actions are covered by process defs");
}

async function seedUiSurfaceIfMissing(client, code, filename) {
  const count = await tableCount(
    client,
    `
    SELECT count(*)::int AS count
    FROM eip_core.ui_surface
    WHERE tenant_id IS NULL
      AND code = $1
      AND is_active = true
      AND is_published = true
    `,
    [code]
  );

  if (count > 0) {
    console.log(`Skipping ${filename}; published global surface '${code}' already exists`);
    return;
  }

  await executeSqlFile(client, filename);
}

async function stageOwnerAdmin() {
  const required = [
    "OWNER_TENANT_CODE",
    "OWNER_TENANT_NAME",
    "OWNER_ADMIN_EMAIL",
    "OWNER_ADMIN_PASSWORD"
  ];
  const missing = required.filter((name) => !String(process.env[name] || "").trim());
  if (missing.length > 0) {
    throw new Error(`owner-admin stage requires ${missing.join(", ")}`);
  }
  await runNodeScript(path.join(apiRoot, "scripts", "seed_first_admin.mjs"));
}

async function stageUiSurfaces(client) {
  await assertTable(client, "eip_core", "ui_surface");
  await seedUiSurfaceIfMissing(client, "admin", "ui_surface_admin.sql");
  await seedUiSurfaceIfMissing(client, "dashboard", "ui_surface_dashboard.sql");
}

async function stageProcessEngine(client) {
  await assertTable(client, "eip_core", "process_def");
  await assertTable(client, "eip_core", "process_binding");
  await assertTable(client, "eip_core", "task_template");
  await assertTable(client, "eip_core", "dropdown_list");
  await assertTable(client, "eip_core", "dropdown_value");
  await assertEffectTaxonomy(client);
  await assertProcessEngineSourceSupport();
  await assertSeedProcessAlignment();
}

async function stageTemplateTenant(client) {
  await executeSqlFile(client, "tenant_template_ecom.sql");
  await executeSqlFile(client, "jurisdiction_iso_seed.sql");
  await executeSqlFile(client, "template_ecom_process.sql");
  await executeSqlFile(client, "template_ecom_canonical_v1.sql");

  const templateCount = await tableCount(
    client,
    "SELECT count(*)::int AS count FROM eip_core.tenant WHERE code = 'eip_ecom'"
  );
  if (templateCount === 0) {
    throw new Error("Template tenant eip_ecom was not created");
  }

  const processCount = await tableCount(
    client,
    `
    SELECT count(*)::int AS count
    FROM eip_core.process_def pd
    JOIN eip_core.tenant t ON t.id = pd.tenant_id
    WHERE t.code = 'eip_ecom'
      AND pd.code = ANY($1::text[])
      AND pd.is_active = true
    `,
    [TEMPLATE_PROCESS_CODES]
  );
  if (processCount < TEMPLATE_PROCESS_CODES.length) {
    throw new Error("Template tenant is missing one or more ecommerce process definitions");
  }

  const bindingCount = await tableCount(
    client,
    `
    SELECT count(DISTINCT pb.service_object_type)::int AS count
    FROM eip_core.process_binding pb
    JOIN eip_core.tenant t ON t.id = pb.tenant_id
    JOIN eip_core.process_def pd ON pd.id = pb.process_def_id
    WHERE t.code = 'eip_ecom'
      AND pb.service_object_type = ANY($1::text[])
      AND pb.is_active = true
      AND pd.is_active = true
    `,
    [TEMPLATE_BINDING_TYPES]
  );
  if (bindingCount < TEMPLATE_BINDING_TYPES.length) {
    throw new Error("Template tenant is missing one or more ecommerce process bindings");
  }

  const taskCount = await tableCount(
    client,
    `
    SELECT count(DISTINCT tt.task_type)::int AS count
    FROM eip_core.task_template tt
    JOIN eip_core.tenant t ON t.id = tt.tenant_id
    JOIN eip_core.process_def pd ON pd.id = tt.process_def_id
    WHERE t.code = 'eip_ecom'
      AND tt.task_type = ANY($1::text[])
      AND tt.is_active = true
      AND pd.is_active = true
    `,
    [TEMPLATE_TASK_TYPES]
  );
  if (taskCount < TEMPLATE_TASK_TYPES.length) {
    throw new Error("Template tenant is missing one or more ecommerce task templates");
  }

  const effectCount = await tableCount(
    client,
    `
    SELECT count(DISTINCT dv.code)::int AS count
    FROM eip_core.tenant t
    JOIN eip_core.dropdown_list dl
      ON dl.tenant_id = t.id
     AND dl.module = 'core'
     AND dl.code = 'PROCESS_EFFECT_TYPE'
     AND dl.version = 1
     AND dl.is_active = true
    JOIN eip_core.dropdown_value dv
      ON dv.list_id = dl.id
     AND dv.is_active = true
    WHERE t.code = 'eip_ecom'
      AND dv.code = ANY($1::text[])
    `,
    [TEMPLATE_EFFECT_TYPES]
  );
  if (effectCount < TEMPLATE_EFFECT_TYPES.length) {
    throw new Error("Template tenant is missing one or more governed ecommerce effect types");
  }

  console.log("Verified eip_ecom canonical template tenant, processes, bindings, tasks, and effect governance");
}

async function stageSamara(client) {
  const tenantCode = firstNonEmpty(process.env.SAMARA_TENANT_CODE, "t_ed6019735b2f");
  const tenantRes = await client.query(
    `
    SELECT id, code, name, attrs
    FROM eip_core.tenant
    WHERE code = $1
    LIMIT 1
    `,
    [tenantCode]
  );
  const tenant = tenantRes.rows[0];
  if (!tenant?.id) {
    throw new Error(`Samara tenant not found: ${tenantCode}`);
  }

  const existingProfiles = extractProfiles(tenant.attrs || {});
  const connectionCode = firstNonEmpty(process.env.SAMARA_CONNECTION_CODE, "samara");
  const existingProfile = existingProfiles.find(
    (profile) => profile.identity?.connection_code === connectionCode
  );

  const environment = firstNonEmpty(
    process.env.SAMARA_CONNECTION_ENVIRONMENT,
    existingProfile?.identity?.environment,
    "production"
  );
  const frontendUrl = firstNonEmpty(
    process.env.SAMARA_FRONTEND_URL,
    existingProfile?.identity?.frontend_url
  );
  const portalUrl = firstNonEmpty(
    process.env.SAMARA_PORTAL_URL,
    existingProfile?.identity?.portal_url,
    frontendUrl
  );
  const originAllowlist = [
    ...parseList(process.env.SAMARA_ORIGIN_ALLOWLIST),
    ...parseList(existingProfile?.inbound?.origin_allowlist?.join(",")),
    urlOrigin(frontendUrl)
  ].filter(Boolean);
  const uniqueOrigins = [...new Set(originAllowlist)];
  const apiKeySecret = firstNonEmpty(process.env.SAMARA_CONNECTION_API_KEY);
  const hasExistingApiKeySecret = Boolean(existingProfile?.verification?.api_key?.secret);
  const allowUnverified = parseBool(process.env.SAMARA_CONNECTION_ALLOW_UNVERIFIED, false);

  if (environment !== "sandbox" && uniqueOrigins.length === 0) {
    throw new Error("samara stage requires SAMARA_FRONTEND_URL or SAMARA_ORIGIN_ALLOWLIST for production");
  }
  if (!apiKeySecret && !hasExistingApiKeySecret && !allowUnverified && environment !== "sandbox") {
    throw new Error(
      "samara stage requires SAMARA_CONNECTION_API_KEY for production, unless an existing secret is already stored"
    );
  }

  const inboundSuffix = firstNonEmpty(
    process.env.SAMARA_INBOUND_SUFFIX,
    existingProfile?.inbound?.inbound_path_suffix,
    "samara"
  );
  const duplicateSuffix = await client.query(
    `
    SELECT id, code
    FROM eip_core.tenant
    WHERE id <> $1::uuid
      AND EXISTS (
        SELECT 1
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(attrs->'connection_profiles') = 'array'
            THEN attrs->'connection_profiles'
            ELSE '[]'::jsonb
          END
        ) AS profile
        WHERE profile->'inbound'->>'inbound_path_suffix' = $2
      )
    LIMIT 1
    `,
    [tenant.id, inboundSuffix]
  );
  if (duplicateSuffix.rowCount > 0) {
    throw new Error(
      `Inbound suffix '${inboundSuffix}' is already used by tenant ${duplicateSuffix.rows[0].code}`
    );
  }

  const rawProfile = {
    id: firstNonEmpty(existingProfile?.id, `seed-${connectionCode}`),
    identity: {
      connection_name: firstNonEmpty(
        process.env.SAMARA_CONNECTION_NAME,
        existingProfile?.identity?.connection_name,
        "Samara Website"
      ),
      connection_code: connectionCode,
      connection_kind: firstNonEmpty(
        process.env.SAMARA_CONNECTION_KIND,
        existingProfile?.identity?.connection_kind,
        "website"
      ),
      frontend_url: frontendUrl,
      portal_url: portalUrl,
      direction: "inbound",
      environment,
      is_enabled: true
    },
    inbound: {
      inbound_path_suffix: inboundSuffix,
      http_method: firstNonEmpty(process.env.SAMARA_HTTP_METHOD, "POST").toUpperCase(),
      expected_content_type: firstNonEmpty(
        process.env.SAMARA_EXPECTED_CONTENT_TYPE,
        "application/json"
      ),
      origin_allowlist: uniqueOrigins,
      raw_body_required: true,
      rate_limit: {
        max: Number(process.env.SAMARA_RATE_LIMIT_MAX || 120),
        window_sec: Number(process.env.SAMARA_RATE_LIMIT_WINDOW_SEC || 60)
      }
    },
    verification: apiKeySecret || hasExistingApiKeySecret
      ? {
          mode: "api_key",
          allow_unverified: false,
          api_key: {
            header_name: firstNonEmpty(process.env.SAMARA_API_KEY_HEADER, "x-api-key"),
            secret: apiKeySecret
          }
        }
      : {
          mode: "none",
          allow_unverified: allowUnverified || environment === "sandbox"
        },
    idempotency: {
      event_id_location: firstNonEmpty(
        process.env.SAMARA_IDEMPOTENCY_LOCATION,
        "header"
      ),
      event_id_key: firstNonEmpty(
        process.env.SAMARA_IDEMPOTENCY_KEY,
        "x-idempotency-key"
      ),
      idempotency_scope: firstNonEmpty(
        process.env.SAMARA_IDEMPOTENCY_SCOPE,
        `gateway.${connectionCode}`
      )
    },
    routing: {
      channel: firstNonEmpty(process.env.SAMARA_ROUTING_CHANNEL, "website_intake"),
      protocol: firstNonEmpty(process.env.SAMARA_ROUTING_PROTOCOL, "HTTPS"),
      supported_message_types: parseList(process.env.SAMARA_MESSAGE_TYPES),
      schema_version: firstNonEmpty(process.env.SAMARA_SCHEMA_VERSION, "v1"),
      envelope_profile: firstNonEmpty(process.env.SAMARA_ENVELOPE_PROFILE, "canonical_v1"),
      mapping_mode: firstNonEmpty(process.env.SAMARA_MAPPING_MODE, "passthrough"),
      mapping_rules: null
    },
    audit: {
      audit_record_type: firstNonEmpty(process.env.SAMARA_AUDIT_RECORD_TYPE, "GATEWAY_AUDIT"),
      redaction_policy: null,
      max_body_size: Number(process.env.SAMARA_MAX_BODY_SIZE || 262144),
      ip_allowlist: parseList(process.env.SAMARA_IP_ALLOWLIST),
      log_level: firstNonEmpty(process.env.SAMARA_LOG_LEVEL, "info")
    }
  };

  const normalized = normalizeProfile(rawProfile, rawProfile.id);
  normalized.routing.require_process_binding = parseBool(
    process.env.SAMARA_REQUIRE_PROCESS_BINDING,
    true
  );

  const nextProfile = existingProfile ? mergeSecrets(existingProfile, normalized) : normalized;
  const nextProfiles = existingProfiles
    .filter((profile) => profile.identity?.connection_code !== connectionCode)
    .concat(nextProfile);
  const validationErrors = validateProfiles(nextProfiles);
  if (validationErrors.length > 0) {
    throw new Error(`Samara connection profile validation failed: ${validationErrors.join("; ")}`);
  }

  await client.query(
    `
    UPDATE eip_core.tenant
    SET attrs = jsonb_set(
      COALESCE(attrs, '{}'::jsonb),
      '{connection_profiles}',
      $2::jsonb,
      true
    ),
    updated_at = now()
    WHERE id = $1::uuid
    `,
    [tenant.id, JSON.stringify(nextProfiles)]
  );

  console.log(`Upserted Samara connection profile '${connectionCode}' for tenant '${tenantCode}'`);
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  if (args.list) {
    console.log(usage());
    return;
  }

  const stages = args.recommended
    ? STAGE_ORDER
    : [...new Set(args.stages)];

  if (stages.length === 0) {
    console.log(usage());
    throw new Error("At least one --stage is required");
  }

  const unknown = stages.filter((stage) => !STAGE_ORDER.includes(stage));
  if (unknown.length > 0) {
    throw new Error(`Unknown stage(s): ${unknown.join(", ")}`);
  }

  await loadEnvFallback();
  const client = await createDbClient();
  await client.connect();

  try {
    for (const stage of stages) {
      console.log(`Starting reseed stage: ${stage}`);
      if (stage === "owner-admin") await stageOwnerAdmin();
      if (stage === "ui-surfaces") await stageUiSurfaces(client);
      if (stage === "process-engine") await stageProcessEngine(client);
      if (stage === "template-tenant") await stageTemplateTenant(client);
      if (stage === "samara") await stageSamara(client);
      console.log(`Completed reseed stage: ${stage}`);
    }
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(`Post-migration reseed failed: ${error?.message || error}`);
  process.exit(1);
});
