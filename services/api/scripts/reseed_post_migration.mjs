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

const TEMPLATE_GOVERNANCE_LIST_CODES = ["PROCESS_ACTION", "PROCESS_EFFECT_TYPE"];
const SAMARA_TENANT_CODE_CANDIDATES = ["samara", "t_ed6019735b2f"];

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
    '  SAMARA_TENANT_CODE="samara" SAMARA_TENANT_NAME="Samara" SAMARA_FRONTEND_URL="https://samara.example" SAMARA_CONNECTION_API_KEY="..." npm run samara:connect',
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

function uniqueList(items) {
  return [...new Set((items || []).map((item) => String(item || "").trim()).filter(Boolean))];
}

function missingFrom(required, found) {
  const foundSet = new Set(found);
  return required.filter((item) => !foundSet.has(item));
}

function collectGraphRequirements(processRows) {
  const actionCodes = new Set();
  const effectCodes = new Set();
  const taskRefs = new Set();
  const graphErrors = [];

  for (const row of processRows) {
    const graph = row.graph || {};
    const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
    const transitions = Array.isArray(graph.transitions) ? graph.transitions : [];
    const nodeIds = new Set(nodes.map((node) => String(node?.id || "").trim()).filter(Boolean));

    if (!nodeIds.has(graph.initial_node)) {
      graphErrors.push(`${row.code}: missing initial node ${graph.initial_node || ""}`);
    }

    for (const node of nodes) {
      const refs = node?.on_enter?.task_template_types || node?.onEnter?.task_template_types || [];
      for (const ref of Array.isArray(refs) ? refs : []) {
        if (ref) taskRefs.add(String(ref));
      }
    }

    for (const transition of transitions) {
      if (!nodeIds.has(transition?.from)) graphErrors.push(`${row.code}: missing from node ${transition?.from || ""}`);
      if (!nodeIds.has(transition?.to)) graphErrors.push(`${row.code}: missing to node ${transition?.to || ""}`);
      if (transition?.action) actionCodes.add(String(transition.action));
      for (const effect of Array.isArray(transition?.effects) ? transition.effects : []) {
        if (effect?.type) effectCodes.add(String(effect.type));
      }
    }
  }

  return { actionCodes, effectCodes, taskRefs, graphErrors };
}

async function readTenantByCode(client, code, { forUpdate = false } = {}) {
  const result = await client.query(
    `
    SELECT id, code, name, attrs, is_active
    FROM eip_core.tenant
    WHERE code = $1
    ${forUpdate ? "FOR UPDATE" : ""}
    LIMIT 1
    `,
    [code]
  );
  return result.rows[0] || null;
}

async function resolveSamaraTenantCode(client) {
  const explicit = firstNonEmpty(process.env.SAMARA_TENANT_CODE);
  if (explicit) return explicit;

  for (const candidate of SAMARA_TENANT_CODE_CANDIDATES) {
    const found = await readTenantByCode(client, candidate);
    if (found) return candidate;
  }

  return SAMARA_TENANT_CODE_CANDIDATES[0];
}

async function ensureSamaraTenant(client, { source, tenantCode, tenantName, frontendUrl, originAllowlist }) {
  const existing = await readTenantByCode(client, tenantCode, { forUpdate: true });
  const now = new Date().toISOString();
  const baseAttrs = {
    template: false,
    canonical_ecom_clone: true,
    ecommerce_template_source: source.code,
    ecommerce_template_synced_at: now,
    samara: {
      connected: true,
      frontend_url: frontendUrl || "",
      template_source: source.code,
      updated_at: now
    },
    storefront: {
      brand: "Samara",
      frontend_url: frontendUrl || ""
    },
    allowed_origins: originAllowlist
  };

  if (!existing) {
    const inserted = await client.query(
      `
      INSERT INTO eip_core.tenant (code, name, attrs, is_active)
      VALUES ($1, $2, $3::jsonb, true)
      RETURNING id, code, name, attrs, is_active
      `,
      [tenantCode, tenantName || "Samara", JSON.stringify(baseAttrs)]
    );
    return { tenant: inserted.rows[0], created: true };
  }

  if (String(existing.attrs?.template || "").toLowerCase() === "true") {
    throw new Error(`Samara tenant ${tenantCode} is marked as a template; refusing to use it as a live tenant`);
  }

  const existingOrigins = Array.isArray(existing.attrs?.allowed_origins)
    ? existing.attrs.allowed_origins
    : parseList(existing.attrs?.allowed_origins);
  const nextAttrs = {
    ...(existing.attrs || {}),
    template: false,
    canonical_ecom_clone: true,
    ecommerce_template_source: source.code,
    ecommerce_template_synced_at: now,
    samara: {
      ...(existing.attrs?.samara || {}),
      connected: true,
      frontend_url: frontendUrl || existing.attrs?.samara?.frontend_url || "",
      template_source: source.code,
      updated_at: now
    },
    storefront: {
      ...(existing.attrs?.storefront || {}),
      brand: existing.attrs?.storefront?.brand || "Samara",
      frontend_url: frontendUrl || existing.attrs?.storefront?.frontend_url || ""
    },
    allowed_origins: uniqueList([...existingOrigins, ...originAllowlist])
  };

  const updated = await client.query(
    `
    UPDATE eip_core.tenant
    SET name = COALESCE(NULLIF($2, ''), name),
        attrs = $3::jsonb,
        is_active = true,
        updated_at = now()
    WHERE id = $1::uuid
    RETURNING id, code, name, attrs, is_active
    `,
    [existing.id, tenantName, JSON.stringify(nextAttrs)]
  );
  return { tenant: updated.rows[0], created: false };
}

async function cloneTemplateMetadata(client, sourceId, targetId) {
  const summary = {};
  let result = await client.query(
    `
    INSERT INTO eip_core.dropdown_list (tenant_id, module, code, name, version, is_active, attrs)
    SELECT $1, module, code, name, version, is_active, attrs
    FROM eip_core.dropdown_list
    WHERE tenant_id = $2
    ON CONFLICT (tenant_id, module, code, version) DO UPDATE
    SET name = EXCLUDED.name,
        is_active = EXCLUDED.is_active,
        attrs = EXCLUDED.attrs,
        updated_at = now()
    `,
    [targetId, sourceId]
  );
  summary.dropdown_lists = result.rowCount;

  result = await client.query(
    `
    INSERT INTO eip_core.dropdown_value (list_id, code, label, sort_order, is_active, attrs)
    SELECT tgt_list.id, dv.code, dv.label, dv.sort_order, dv.is_active, dv.attrs
    FROM eip_core.dropdown_value dv
    JOIN eip_core.dropdown_list src_list
      ON src_list.id = dv.list_id
     AND src_list.tenant_id = $2
    JOIN eip_core.dropdown_list tgt_list
      ON tgt_list.tenant_id = $1
     AND tgt_list.module = src_list.module
     AND tgt_list.code = src_list.code
     AND tgt_list.version = src_list.version
    ON CONFLICT (list_id, code) DO UPDATE
    SET label = EXCLUDED.label,
        sort_order = EXCLUDED.sort_order,
        is_active = EXCLUDED.is_active,
        attrs = EXCLUDED.attrs,
        updated_at = now()
    `,
    [targetId, sourceId]
  );
  summary.dropdown_values = result.rowCount;

  result = await client.query(
    `
    INSERT INTO eip_core.schema_registry
      (tenant_id, module, object_kind, object_type, version, is_active, schema_json, ui_json)
    SELECT
      $1, module, object_kind, object_type, version, is_active, schema_json, ui_json
    FROM eip_core.schema_registry
    WHERE tenant_id = $2
    ON CONFLICT (tenant_id, module, object_kind, object_type, version) DO UPDATE
    SET is_active = EXCLUDED.is_active,
        schema_json = EXCLUDED.schema_json,
        ui_json = EXCLUDED.ui_json,
        updated_at = now()
    `,
    [targetId, sourceId]
  );
  summary.schema_registry = result.rowCount;

  result = await client.query(
    `
    INSERT INTO eip_core.schema_bundle
      (tenant_id, module, version, is_published, bundle_json, etag)
    SELECT
      $1, module, version, is_published, bundle_json, etag
    FROM eip_core.schema_bundle
    WHERE tenant_id = $2
    ON CONFLICT (tenant_id, module, version) DO UPDATE
    SET is_published = EXCLUDED.is_published,
        bundle_json = EXCLUDED.bundle_json,
        etag = EXCLUDED.etag,
        updated_at = now()
    `,
    [targetId, sourceId]
  );
  summary.schema_bundles = result.rowCount;

  result = await client.query(
    `
    INSERT INTO eip_core.process_def
      (tenant_id, code, name, version, is_active, graph, attrs)
    SELECT
      $1, code, name, version, is_active, graph, attrs
    FROM eip_core.process_def
    WHERE tenant_id = $2
      AND code = ANY($3::text[])
    ON CONFLICT (tenant_id, code, version) DO UPDATE
    SET name = EXCLUDED.name,
        is_active = EXCLUDED.is_active,
        graph = EXCLUDED.graph,
        attrs = EXCLUDED.attrs,
        updated_at = now()
    `,
    [targetId, sourceId, TEMPLATE_PROCESS_CODES]
  );
  summary.process_defs = result.rowCount;

  result = await client.query(
    `
    INSERT INTO eip_core.task_template
      (tenant_id, process_def_id, service_object_type, task_type, title, description, is_active, sort_order, attrs)
    SELECT
      $1,
      tgt_def.id,
      tt.service_object_type,
      tt.task_type,
      tt.title,
      tt.description,
      tt.is_active,
      tt.sort_order,
      tt.attrs
    FROM eip_core.task_template tt
    JOIN eip_core.process_def src_def
      ON src_def.id = tt.process_def_id
     AND src_def.tenant_id = $2
     AND src_def.code = ANY($3::text[])
    JOIN eip_core.process_def tgt_def
      ON tgt_def.tenant_id = $1
     AND tgt_def.code = src_def.code
     AND tgt_def.version = src_def.version
    WHERE tt.is_active = true
    ON CONFLICT (tenant_id, process_def_id, COALESCE(service_object_type, ''), task_type) DO UPDATE
    SET title = EXCLUDED.title,
        description = EXCLUDED.description,
        is_active = EXCLUDED.is_active,
        sort_order = EXCLUDED.sort_order,
        attrs = EXCLUDED.attrs,
        updated_at = now()
    `,
    [targetId, sourceId, TEMPLATE_PROCESS_CODES]
  );
  summary.task_templates = result.rowCount;

  result = await client.query(
    `
    INSERT INTO eip_core.process_binding
      (tenant_id, service_object_type, process_def_id, is_active, priority, task_type, attrs)
    SELECT
      $1,
      pb.service_object_type,
      tgt_def.id,
      pb.is_active,
      pb.priority,
      pb.task_type,
      pb.attrs
    FROM eip_core.process_binding pb
    JOIN eip_core.process_def src_def
      ON src_def.id = pb.process_def_id
     AND src_def.tenant_id = $2
     AND src_def.code = ANY($3::text[])
    JOIN eip_core.process_def tgt_def
      ON tgt_def.tenant_id = $1
     AND tgt_def.code = src_def.code
     AND tgt_def.version = src_def.version
    WHERE pb.is_active = true
    ON CONFLICT (tenant_id, service_object_type, process_def_id, COALESCE(task_type, '')) DO UPDATE
    SET is_active = EXCLUDED.is_active,
        priority = EXCLUDED.priority,
        attrs = EXCLUDED.attrs,
        updated_at = now()
    `,
    [targetId, sourceId, TEMPLATE_PROCESS_CODES]
  );
  summary.process_bindings = result.rowCount;

  result = await client.query(
    `
    INSERT INTO eip_core.ui_surface
      (tenant_id, code, title, version, is_active, is_published, is_public, tree, attrs)
    SELECT
      $1, code, title, version, is_active, is_published, is_public, tree, attrs
    FROM eip_core.ui_surface
    WHERE tenant_id = $2
    ON CONFLICT (tenant_id, code, version) DO UPDATE
    SET title = EXCLUDED.title,
        is_active = EXCLUDED.is_active,
        is_published = EXCLUDED.is_published,
        is_public = EXCLUDED.is_public,
        tree = EXCLUDED.tree,
        attrs = EXCLUDED.attrs,
        updated_at = now()
    `,
    [targetId, sourceId]
  );
  summary.ui_surfaces = result.rowCount;

  result = await client.query(
    `
    INSERT INTO eip_core.commercial_condition
      (tenant_id, code, label, condition_type, condition_category, priority, valid_from, valid_to, is_active, scope, effect, attrs)
    SELECT
      $1, code, label, condition_type, condition_category, priority, valid_from, valid_to, is_active, scope, effect, attrs
    FROM eip_core.commercial_condition
    WHERE tenant_id = $2
    ON CONFLICT (tenant_id, code) DO UPDATE
    SET label = EXCLUDED.label,
        condition_type = EXCLUDED.condition_type,
        condition_category = EXCLUDED.condition_category,
        priority = EXCLUDED.priority,
        valid_from = EXCLUDED.valid_from,
        valid_to = EXCLUDED.valid_to,
        is_active = EXCLUDED.is_active,
        scope = EXCLUDED.scope,
        effect = EXCLUDED.effect,
        attrs = EXCLUDED.attrs,
        updated_at = now()
    `,
    [targetId, sourceId]
  );
  summary.commercial_conditions = result.rowCount;

  result = await client.query(
    `
    INSERT INTO eip_core.tenant_module_setting
      (tenant_id, module, code, attrs, is_active)
    SELECT
      $1, module, code, attrs, is_active
    FROM eip_core.tenant_module_setting
    WHERE tenant_id = $2
    ON CONFLICT (tenant_id, module, code) DO UPDATE
    SET attrs = EXCLUDED.attrs,
        is_active = EXCLUDED.is_active,
        updated_at = now()
    `,
    [targetId, sourceId]
  );
  summary.tenant_module_settings = result.rowCount;

  return summary;
}

async function listGovernanceValues(client, tenantCode, listCode) {
  const result = await client.query(
    `
    SELECT dv.code
    FROM eip_core.tenant t
    JOIN eip_core.dropdown_list dl
      ON dl.tenant_id = t.id
     AND dl.code = $2
     AND dl.is_active = true
    JOIN eip_core.dropdown_value dv
      ON dv.list_id = dl.id
     AND dv.is_active = true
    WHERE t.code = $1
    `,
    [tenantCode, listCode]
  );
  return result.rows.map((row) => row.code);
}

async function verifyEcomTenantBaseline(client, tenantCode) {
  const processResult = await client.query(
    `
    SELECT pd.code, pd.graph
    FROM eip_core.tenant t
    JOIN eip_core.process_def pd
      ON pd.tenant_id = t.id
     AND pd.is_active = true
    WHERE t.code = $1
      AND pd.code = ANY($2::text[])
    `,
    [tenantCode, TEMPLATE_PROCESS_CODES]
  );
  const processCodes = processResult.rows.map((row) => row.code);

  const taskResult = await client.query(
    `
    SELECT DISTINCT tt.task_type
    FROM eip_core.tenant t
    JOIN eip_core.task_template tt
      ON tt.tenant_id = t.id
     AND tt.is_active = true
    JOIN eip_core.process_def pd
      ON pd.id = tt.process_def_id
     AND pd.is_active = true
    WHERE t.code = $1
      AND pd.code = ANY($2::text[])
      AND tt.task_type = ANY($3::text[])
    `,
    [tenantCode, TEMPLATE_PROCESS_CODES, TEMPLATE_TASK_TYPES]
  );
  const taskTypes = taskResult.rows.map((row) => row.task_type);

  const bindingResult = await client.query(
    `
    SELECT DISTINCT pb.service_object_type
    FROM eip_core.tenant t
    JOIN eip_core.process_binding pb
      ON pb.tenant_id = t.id
     AND pb.is_active = true
    JOIN eip_core.process_def pd
      ON pd.id = pb.process_def_id
     AND pd.is_active = true
    WHERE t.code = $1
      AND pd.code = ANY($2::text[])
      AND pb.service_object_type = ANY($3::text[])
    `,
    [tenantCode, TEMPLATE_PROCESS_CODES, TEMPLATE_BINDING_TYPES]
  );
  const bindingTypes = bindingResult.rows.map((row) => row.service_object_type);

  const effectGovernance = await listGovernanceValues(client, tenantCode, "PROCESS_EFFECT_TYPE");
  const actionGovernance = await listGovernanceValues(client, tenantCode, "PROCESS_ACTION");
  const graphRequirements = collectGraphRequirements(processResult.rows);
  const errors = [
    ...missingFrom(TEMPLATE_PROCESS_CODES, processCodes).map((code) => `missing process ${code}`),
    ...missingFrom(TEMPLATE_TASK_TYPES, taskTypes).map((code) => `missing task template ${code}`),
    ...missingFrom(TEMPLATE_BINDING_TYPES, bindingTypes).map((code) => `missing process binding ${code}`),
    ...missingFrom(TEMPLATE_EFFECT_TYPES, effectGovernance).map((code) => `missing governed effect ${code}`),
    ...missingFrom([...graphRequirements.effectCodes], effectGovernance).map((code) => `graph effect is not governed ${code}`),
    ...missingFrom([...graphRequirements.actionCodes], actionGovernance).map((code) => `graph action is not governed ${code}`),
    ...missingFrom([...graphRequirements.taskRefs], taskTypes).map((code) => `graph task ref has no active template ${code}`),
    ...graphRequirements.graphErrors
  ];

  if (errors.length > 0) {
    throw new Error(`Samara ecommerce baseline verification failed: ${errors.join("; ")}`);
  }

  return {
    processes: processCodes.length,
    task_templates: taskTypes.length,
    process_bindings: bindingTypes.length,
    governed_effects: TEMPLATE_EFFECT_TYPES.filter((code) => effectGovernance.includes(code)).length,
    governed_lists: TEMPLATE_GOVERNANCE_LIST_CODES.length
  };
}

async function stageSamara(client) {
  await assertTable(client, "eip_core", "tenant");
  await assertTable(client, "eip_core", "process_def");
  await assertTable(client, "eip_core", "process_binding");
  await assertTable(client, "eip_core", "task_template");
  await assertTable(client, "eip_core", "dropdown_list");
  await assertTable(client, "eip_core", "dropdown_value");

  const sourceCode = firstNonEmpty(
    process.env.SAMARA_SOURCE_TENANT_CODE,
    process.env.SAMARA_TEMPLATE_SOURCE_CODE,
    "eip_ecom"
  );
  const tenantCode = await resolveSamaraTenantCode(client);
  const tenantName = firstNonEmpty(process.env.SAMARA_TENANT_NAME);
  const source = await readTenantByCode(client, sourceCode);
  if (!source?.id) {
    throw new Error(`Samara source template tenant not found: ${sourceCode}`);
  }
  if (String(source.attrs?.template || "").toLowerCase() !== "true") {
    throw new Error(`Samara source tenant ${sourceCode} is not marked as a template`);
  }

  const existingBefore = await readTenantByCode(client, tenantCode);
  const existingProfiles = extractProfiles(existingBefore?.attrs || {});
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
  const originAllowlist = uniqueList([
    ...parseList(process.env.SAMARA_ORIGIN_ALLOWLIST),
    ...(Array.isArray(existingProfile?.inbound?.origin_allowlist) ? existingProfile.inbound.origin_allowlist : []),
    urlOrigin(frontendUrl)
  ]);
  const apiKeySecret = firstNonEmpty(process.env.SAMARA_CONNECTION_API_KEY);
  const hasExistingApiKeySecret = Boolean(existingProfile?.verification?.api_key?.secret);
  const allowUnverified = parseBool(process.env.SAMARA_CONNECTION_ALLOW_UNVERIFIED, false);

  if (environment !== "sandbox" && originAllowlist.length === 0) {
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

  await client.query("BEGIN");
  try {
    const ensured = await ensureSamaraTenant(client, {
      source,
      tenantCode,
      tenantName: tenantName || "Samara",
      frontendUrl,
      originAllowlist
    });
    const tenant = ensured.tenant;

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

    const cloneSummary = await cloneTemplateMetadata(client, source.id, tenant.id);
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
        origin_allowlist: originAllowlist,
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
          "x-event-id"
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

    const profilesFromCurrentTenant = extractProfiles(tenant.attrs || {});
    const nextProfile = existingProfile ? mergeSecrets(existingProfile, normalized) : normalized;
    const nextProfiles = profilesFromCurrentTenant
      .filter((profile) => profile.identity?.connection_code !== connectionCode)
      .concat(nextProfile);
    const validationErrors = validateProfiles(nextProfiles);
    if (validationErrors.length > 0) {
      throw new Error(`Samara connection profile validation failed: ${validationErrors.join("; ")}`);
    }

    const updatedAttrs = {
      ...(tenant.attrs || {}),
      connection_profiles: nextProfiles,
      samara: {
        ...(tenant.attrs?.samara || {}),
        connected: true,
        frontend_url: frontendUrl || "",
        connection_code: connectionCode,
        inbound_suffix: inboundSuffix,
        template_source: source.code,
        updated_at: new Date().toISOString()
      },
      storefront: {
        ...(tenant.attrs?.storefront || {}),
        brand: tenant.attrs?.storefront?.brand || "Samara",
        frontend_url: frontendUrl || ""
      },
      allowed_origins: uniqueList([
        ...(Array.isArray(tenant.attrs?.allowed_origins) ? tenant.attrs.allowed_origins : []),
        ...originAllowlist
      ])
    };

    await client.query(
      `
      UPDATE eip_core.tenant
      SET attrs = $2::jsonb,
          updated_at = now()
      WHERE id = $1::uuid
      `,
      [tenant.id, JSON.stringify(updatedAttrs)]
    );
    const verification = await verifyEcomTenantBaseline(client, tenantCode);
    await client.query("COMMIT");

    console.log(
      `Samara tenant '${tenantCode}' ${ensured.created ? "created" : "reconciled"} from '${sourceCode}'`
    );
    console.log(`Samara clone summary: ${JSON.stringify(cloneSummary)}`);
    console.log(`Samara verification counts: ${JSON.stringify(verification)}`);
    console.log(`Upserted Samara connection profile '${connectionCode}' with inbound suffix '${inboundSuffix}'`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
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
