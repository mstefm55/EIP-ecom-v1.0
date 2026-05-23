import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(apiRoot, "../..");

const CANONICAL_PROCESS_CODES = [
  "ECOM_PRODUCT_ONBOARDING",
  "ECOM_SALES_ORDER_FLOW",
  "ECOM_RETURN_FLOW",
  "ECOM_REFUND_FLOW",
  "ECOM_PAYMENT_FLOW",
  "ECOM_STOREFRONT_CONTENT_FLOW"
];

const CANONICAL_BINDING_TYPES = [
  "product",
  "sales_order",
  "return_request",
  "refund_request",
  "payment",
  "storefront_content"
];

const CANONICAL_TASK_TYPES = [
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

const REQUIRED_EFFECT_TYPES = [
  "STATUS_SET",
  "JSON_MERGE",
  "CHILD_SERVICE_OBJECT_CREATE",
  "INSTANCE_START",
  "ACCESS_GRANT_CREATE",
  "VARIANT_INVENTORY_VALIDATE"
];

const GOVERNANCE_LIST_CODES = ["PROCESS_ACTION", "PROCESS_EFFECT_TYPE"];

function parseArgs(argv) {
  const out = {
    sourceCode: process.env.SMOKE_CLONE_SOURCE_TENANT_CODE || "eip_ecom",
    targetCode: process.env.SMOKE_CLONE_TARGET_TENANT_CODE || "",
    targetName: process.env.SMOKE_CLONE_TARGET_TENANT_NAME || "",
    verifyOnly: false,
    json: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const readNext = (name) => {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
      i += 1;
      return value;
    };

    if (arg === "--source-code") out.sourceCode = readNext(arg);
    else if (arg.startsWith("--source-code=")) out.sourceCode = arg.slice("--source-code=".length);
    else if (arg === "--target-code") out.targetCode = readNext(arg);
    else if (arg.startsWith("--target-code=")) out.targetCode = arg.slice("--target-code=".length);
    else if (arg === "--target-name") out.targetName = readNext(arg);
    else if (arg.startsWith("--target-name=")) out.targetName = arg.slice("--target-name=".length);
    else if (arg === "--verify-only") out.verifyOnly = true;
    else if (arg === "--json") out.json = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(usage());
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  out.sourceCode = normalizeCode(out.sourceCode);
  out.targetCode = normalizeCode(out.targetCode);
  out.targetName = String(out.targetName || "").trim();
  return out;
}

function usage() {
  return [
    "Usage:",
    "  npm run template:smoke-clone -- --target-code eip_ecom_smoke --target-name \"EIP Ecom Smoke Clone\"",
    "  npm run template:smoke-clone -- --source-code eip_ecom --target-code eip_ecom_smoke --target-name \"EIP Ecom Smoke Clone\"",
    "  npm run template:smoke-clone -- --target-code eip_ecom_smoke --verify-only",
    "",
    "Env alternatives:",
    "  SMOKE_CLONE_SOURCE_TENANT_CODE=eip_ecom",
    "  SMOKE_CLONE_TARGET_TENANT_CODE=eip_ecom_smoke",
    "  SMOKE_CLONE_TARGET_TENANT_NAME=\"EIP Ecom Smoke Clone\""
  ].join("\n");
}

function normalizeCode(value) {
  return String(value || "").trim();
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
  const envPaths = [path.join(repoRoot, ".env"), path.join(apiRoot, ".env")];
  for (const envPath of envPaths) {
    try {
      const parsed = parseDotEnv(await fs.readFile(envPath, "utf8"));
      for (const [key, value] of Object.entries(parsed)) {
        process.env[key] = value;
      }
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
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

async function resolveTenant(client, code, { forUpdate = false } = {}) {
  const result = await client.query(
    `
    SELECT id, code, name, attrs, is_active
    FROM eip_core.tenant
    WHERE code = $1
    ${forUpdate ? "FOR UPDATE" : ""}
    `,
    [code]
  );
  return result.rows[0] || null;
}

async function ensureSmokeTargetTenant(client, { source, targetCode, targetName }) {
  const now = new Date().toISOString();
  const smokeAttrs = {
    template: false,
    smoke_clone: true,
    smoke_clone_source: source.code,
    canonical_clone_validation: true,
    disposable: true,
    last_smoke_clone_at: now
  };

  const existing = await resolveTenant(client, targetCode, { forUpdate: true });
  if (!existing) {
    const inserted = await client.query(
      `
      INSERT INTO eip_core.tenant (code, name, attrs, is_active)
      VALUES ($1, $2, $3::jsonb, true)
      RETURNING id, code, name, attrs, is_active
      `,
      [targetCode, targetName, JSON.stringify(smokeAttrs)]
    );
    return { tenant: inserted.rows[0], created: true };
  }

  const isTemplate = String(existing.attrs?.template || "").toLowerCase() === "true";
  const isSmokeClone =
    existing.attrs?.smoke_clone === true ||
    String(existing.attrs?.smoke_clone_source || "") === source.code;

  if (isTemplate) {
    throw new Error(`Target tenant ${targetCode} is a template tenant; refusing smoke clone`);
  }
  if (!isSmokeClone) {
    throw new Error(
      `Target tenant ${targetCode} exists and is not marked as a smoke clone; choose a disposable target code`
    );
  }

  const updated = await client.query(
    `
    UPDATE eip_core.tenant
    SET name = $2,
        attrs = COALESCE(attrs, '{}'::jsonb) || $3::jsonb,
        is_active = true,
        updated_at = now()
    WHERE id = $1
    RETURNING id, code, name, attrs, is_active
    `,
    [existing.id, targetName, JSON.stringify(smokeAttrs)]
  );
  return { tenant: updated.rows[0], created: false };
}

async function cloneGovernance(client, sourceId, targetId) {
  const summary = {};
  let result = await client.query(
    `
    INSERT INTO eip_core.dropdown_list (tenant_id, module, code, name, version, is_active, attrs)
    SELECT $1, module, code, name, version, is_active, attrs
    FROM eip_core.dropdown_list
    WHERE tenant_id = $2
      AND code = ANY($3::text[])
    ON CONFLICT (tenant_id, module, code, version) DO UPDATE
    SET name = EXCLUDED.name,
        is_active = EXCLUDED.is_active,
        attrs = EXCLUDED.attrs,
        updated_at = now()
    `,
    [targetId, sourceId, GOVERNANCE_LIST_CODES]
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
     AND src_list.code = ANY($3::text[])
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
    [targetId, sourceId, GOVERNANCE_LIST_CODES]
  );
  summary.dropdown_values = result.rowCount;
  return summary;
}

async function cloneProcesses(client, sourceId, targetId) {
  const summary = {};
  let result = await client.query(
    `
    INSERT INTO eip_core.process_def
      (tenant_id, code, name, version, is_active, graph, attrs)
    SELECT $1, code, name, version, is_active, graph, attrs
    FROM eip_core.process_def
    WHERE tenant_id = $2
      AND code = ANY($3::text[])
      AND is_active = true
    ON CONFLICT (tenant_id, code, version) DO UPDATE
    SET name = EXCLUDED.name,
        is_active = EXCLUDED.is_active,
        graph = EXCLUDED.graph,
        attrs = EXCLUDED.attrs,
        updated_at = now()
    `,
    [targetId, sourceId, CANONICAL_PROCESS_CODES]
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
    [targetId, sourceId, CANONICAL_PROCESS_CODES]
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
    [targetId, sourceId, CANONICAL_PROCESS_CODES]
  );
  summary.process_bindings = result.rowCount;

  return summary;
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

async function listTargetGovernanceValues(client, targetCode, listCode) {
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
    [targetCode, listCode]
  );
  return result.rows.map((row) => row.code);
}

async function verifyClone(client, targetCode) {
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
    [targetCode, CANONICAL_PROCESS_CODES]
  );
  const processCodes = processResult.rows.map((row) => row.code);
  const missingProcesses = missingFrom(CANONICAL_PROCESS_CODES, processCodes);

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
    [targetCode, CANONICAL_PROCESS_CODES, CANONICAL_TASK_TYPES]
  );
  const taskTypes = taskResult.rows.map((row) => row.task_type);
  const missingTaskTypes = missingFrom(CANONICAL_TASK_TYPES, taskTypes);

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
    [targetCode, CANONICAL_PROCESS_CODES, CANONICAL_BINDING_TYPES]
  );
  const bindingTypes = bindingResult.rows.map((row) => row.service_object_type);
  const missingBindingTypes = missingFrom(CANONICAL_BINDING_TYPES, bindingTypes);

  const effectGovernance = await listTargetGovernanceValues(client, targetCode, "PROCESS_EFFECT_TYPE");
  const actionGovernance = await listTargetGovernanceValues(client, targetCode, "PROCESS_ACTION");
  const missingEffectTypes = missingFrom(REQUIRED_EFFECT_TYPES, effectGovernance);

  const graphRequirements = collectGraphRequirements(processResult.rows);
  const missingGraphEffects = missingFrom([...graphRequirements.effectCodes], effectGovernance);
  const missingGraphActions = missingFrom([...graphRequirements.actionCodes], actionGovernance);
  const missingGraphTaskRefs = missingFrom([...graphRequirements.taskRefs], taskTypes);

  const errors = [
    ...missingProcesses.map((code) => `missing process ${code}`),
    ...missingTaskTypes.map((code) => `missing active task template ${code}`),
    ...missingBindingTypes.map((code) => `missing process binding ${code}`),
    ...missingEffectTypes.map((code) => `missing governed effect ${code}`),
    ...missingGraphEffects.map((code) => `graph effect is not governed ${code}`),
    ...missingGraphActions.map((code) => `graph action is not governed ${code}`),
    ...missingGraphTaskRefs.map((code) => `graph task ref has no active template ${code}`),
    ...graphRequirements.graphErrors
  ];

  return {
    ok: errors.length === 0,
    errors,
    counts: {
      processes: processCodes.length,
      task_templates: taskTypes.length,
      process_bindings: bindingTypes.length,
      governed_effects: effectGovernance.filter((code) => REQUIRED_EFFECT_TYPES.includes(code)).length,
      governed_actions_used: [...graphRequirements.actionCodes].filter((code) => actionGovernance.includes(code)).length
    },
    expected: {
      processes: CANONICAL_PROCESS_CODES.length,
      task_templates: CANONICAL_TASK_TYPES.length,
      process_bindings: CANONICAL_BINDING_TYPES.length,
      governed_effects: REQUIRED_EFFECT_TYPES.length
    }
  };
}

async function run() {
  await loadEnvFallback();
  const args = parseArgs(process.argv.slice(2));

  if (!args.targetCode) {
    throw new Error("Target tenant code is required. Use --target-code or SMOKE_CLONE_TARGET_TENANT_CODE.");
  }
  if (!args.verifyOnly && !args.targetName) {
    throw new Error("Target tenant name is required for clone mode. Use --target-name or SMOKE_CLONE_TARGET_TENANT_NAME.");
  }
  if (args.sourceCode === args.targetCode) {
    throw new Error("Source and target tenant codes must differ");
  }

  const client = new Client(buildDbConfig());
  await client.connect();

  try {
    const source = await resolveTenant(client, args.sourceCode);
    if (!source) throw new Error(`Source tenant not found: ${args.sourceCode}`);
    if (String(source.attrs?.template || "").toLowerCase() !== "true") {
      throw new Error(`Source tenant ${args.sourceCode} is not marked as a template`);
    }

    let cloneSummary = null;
    let target = await resolveTenant(client, args.targetCode);

    if (!args.verifyOnly) {
      await client.query("BEGIN");
      try {
        const ensured = await ensureSmokeTargetTenant(client, {
          source,
          targetCode: args.targetCode,
          targetName: args.targetName
        });
        target = ensured.tenant;
        const governance = await cloneGovernance(client, source.id, target.id);
        const processes = await cloneProcesses(client, source.id, target.id);
        cloneSummary = { target_created: ensured.created, ...governance, ...processes };
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    if (!target) throw new Error(`Target tenant not found: ${args.targetCode}`);
    const verification = await verifyClone(client, args.targetCode);
    if (!verification.ok) {
      const payload = { ok: false, source: args.sourceCode, target: args.targetCode, clone: cloneSummary, verification };
      if (args.json) console.log(JSON.stringify(payload, null, 2));
      throw new Error(`Smoke clone verification failed: ${verification.errors.join("; ")}`);
    }

    const payload = {
      ok: true,
      source: args.sourceCode,
      target: args.targetCode,
      clone: cloneSummary,
      verification
    };

    if (args.json) {
      console.log(JSON.stringify(payload, null, 2));
    } else {
      if (cloneSummary) {
        console.log(`Smoke clone complete: ${args.sourceCode} -> ${args.targetCode}`);
        console.log(`Clone summary: ${JSON.stringify(cloneSummary)}`);
      }
      console.log(`Smoke clone verification OK for ${args.targetCode}`);
      console.log(`Verification counts: ${JSON.stringify(verification.counts)}`);
    }
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
