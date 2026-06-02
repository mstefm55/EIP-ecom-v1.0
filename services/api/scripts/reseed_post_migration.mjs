import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(apiRoot, "../..");
const seedDir = path.join(apiRoot, "db", "seed");

const STAGE_ORDER = [
  "owner-admin",
  "ui-surfaces",
  "process-engine",
  "template-tenant"
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

const CRM_TEMPLATE_PROCESS_CODES = [
  "CRM_INTERACTION_FLOW_V1",
  "CRM_CASE_FLOW_V1",
  "CRM_OPPORTUNITY_FLOW_V1",
  "CRM_LEAD_FLOW_V1",
  "CRM_CAMPAIGN_FLOW_V1",
  "CRM_SEGMENT_REVIEW_FLOW_V1",
  "CRM_INTAKE_REVIEW_FLOW_V1",
  "CRM_MAILBOX_MESSAGE_FLOW_V1",
  "CRM_REPLY_REVIEW_FLOW_V1"
];

const CRM_MAILBOX_DROPDOWN_CODES = [
  "CRM_MAILBOX_PROVIDER",
  "CRM_MAILBOX_MESSAGE_STATUS",
  "CRM_MAILBOX_DIRECTION",
  "CRM_REPLY_STATUS"
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
  await executeSqlFile(client, "template_crm_canonical_v1.sql");

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

  const crmProcessCount = await tableCount(
    client,
    `
    SELECT count(DISTINCT pd.code)::int AS count
    FROM eip_core.process_def pd
    JOIN eip_core.tenant t ON t.id = pd.tenant_id
    WHERE t.code = 'eip_ecom'
      AND pd.code = ANY($1::text[])
      AND pd.is_active = true
    `,
    [CRM_TEMPLATE_PROCESS_CODES]
  );
  if (crmProcessCount < CRM_TEMPLATE_PROCESS_CODES.length) {
    throw new Error("Template tenant is missing one or more CRM process definitions");
  }

  const crmBindingCount = await tableCount(
    client,
    `
    SELECT count(DISTINCT pd.code)::int AS count
    FROM eip_core.process_binding pb
    JOIN eip_core.process_def pd ON pd.id = pb.process_def_id
    JOIN eip_core.tenant t ON t.id = pb.tenant_id
    WHERE t.code = 'eip_ecom'
      AND pd.code = ANY($1::text[])
      AND pb.is_active = true
      AND pd.is_active = true
    `,
    [CRM_TEMPLATE_PROCESS_CODES]
  );
  if (crmBindingCount < CRM_TEMPLATE_PROCESS_CODES.length) {
    throw new Error("Template tenant is missing one or more CRM process bindings");
  }

  const crmMailboxTaskCount = await tableCount(
    client,
    `
    SELECT count(DISTINCT pd.code)::int AS count
    FROM eip_core.task_template tt
    JOIN eip_core.process_def pd ON pd.id = tt.process_def_id
    JOIN eip_core.tenant t ON t.id = tt.tenant_id
    WHERE t.code = 'eip_ecom'
      AND pd.code = ANY($1::text[])
      AND tt.is_active = true
      AND pd.is_active = true
    `,
    [["CRM_MAILBOX_MESSAGE_FLOW_V1", "CRM_REPLY_REVIEW_FLOW_V1"]]
  );
  if (crmMailboxTaskCount < 2) {
    throw new Error("Template tenant is missing one or more CRM mailbox task templates");
  }

  const crmMailboxDropdownCount = await tableCount(
    client,
    `
    SELECT count(DISTINCT code)::int AS count
    FROM eip_core.dropdown_list
    WHERE tenant_id IS NULL
      AND module = 'crm'
      AND code = ANY($1::text[])
      AND is_active = true
    `,
    [CRM_MAILBOX_DROPDOWN_CODES]
  );
  if (crmMailboxDropdownCount < CRM_MAILBOX_DROPDOWN_CODES.length) {
    throw new Error("Global CRM governance is missing one or more mailbox dropdowns");
  }

  const crmMailboxCapabilityCount = await tableCount(
    client,
    `
    SELECT count(*)::int AS count
    FROM eip_core.tenant_module_setting setting
    JOIN eip_core.tenant tenant ON tenant.id = setting.tenant_id
    WHERE tenant.code = 'eip_ecom'
      AND setting.module = 'crm'
      AND setting.code = 'subscription'
      AND setting.is_active = true
      AND setting.attrs->'capabilities'->>'mailbox' = 'true'
    `
  );
  if (crmMailboxCapabilityCount === 0) {
    throw new Error("Template tenant is missing CRM mailbox capability metadata");
  }

  console.log("Verified eip_ecom canonical template tenant, ecommerce and CRM processes, bindings, tasks, dropdown governance, and CRM capability metadata");
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
