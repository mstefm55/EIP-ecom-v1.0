// services/api/src/routes/core_process.js
import { hasPermission } from "../../auth/perm.js";
import { sha256Hex, timingSafeEqual } from "../../auth/crypto.js";
import {
  createDef,
  createInstance,
  advanceInstance,
  findActiveInstance
} from "../../core/core_process_engine.js";

const MAX_LIMIT = 200;
const PROCESS_NODE_TYPE_LIST = "PROCESS_NODE_TYPE";
const PROCESS_EDGE_TYPE_LIST = "PROCESS_EDGE_TYPE";
const PROCESS_EFFECT_TYPE_LIST = "PROCESS_EFFECT_TYPE";
const PROCESS_ACTION_LIST = "PROCESS_ACTION";
const TASK_ACTION_LIST = "TASK_ACTION";

function clampLimit(value) {
  const n = Number(value || 50);
  if (!Number.isFinite(n)) return 50;
  return Math.max(1, Math.min(MAX_LIMIT, n));
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeOptionalText(value) {
  const trimmed = normalizeText(value);
  return trimmed.length ? trimmed : null;
}

function normalizeUpper(value) {
  return normalizeText(value).toUpperCase();
}

async function hasAnyPermission(app, tenantId, identityId, codes) {
  for (const code of codes) {
    const allowed = await hasPermission(app, tenantId, identityId, code);
    if (allowed) return true;
  }
  return false;
}

async function requirePerm(app, req, reply, permCodes) {
  const s = await app.requireSession(req, { realm: "EIP" });
  if (!s.ok) {
    reply.code(s.status).send({ ok: false, error: s.error });
    return null;
  }

  const c = await app.requireCsrf(req);
  if (!c.ok) {
    reply.code(c.status).send({ ok: false, error: c.error });
    return null;
  }

  const allowed = await hasAnyPermission(app, s.session.tenant_id, s.session.identity_id, permCodes);
  if (!allowed) {
    reply.code(403).send({ ok: false, error: "FORBIDDEN" });
    return null;
  }

  return s.session;
}

async function isAdminExec(app, tenantId, identityId) {
  const r = await app.db.query(
    `
    SELECT 1
    FROM eip_authz.identity_role ir
    JOIN eip_authz.role r ON r.id = ir.role_id
    WHERE ir.tenant_id=$1
      AND ir.identity_id=$2
      AND r.is_active=true
      AND r.code IN ('ADMIN_EXEC','ADMIN_SUPER')
    LIMIT 1
    `,
    [tenantId, identityId]
  );
  return r.rowCount > 0;
}

async function hasAdminTenantAccess(app, identityId, tenantId) {
  const r = await app.db.query(
    `
    SELECT 1
    FROM eip_authz.admin_tenant_access
    WHERE admin_identity_id=$1
      AND tenant_id=$2
      AND is_active=true
    LIMIT 1
    `,
    [identityId, tenantId]
  );
  return r.rowCount > 0;
}

async function hasPortfolioAccess(app, identityId, tenantId) {
  const r = await app.db.query(
    `
    SELECT 1
    FROM eip_core.tenant t
    JOIN eip_authz.admin_portfolio p ON p.id = t.admin_portfolio_id
    WHERE t.id=$1
      AND p.admin_identity_id=$2
      AND p.is_active=true
    LIMIT 1
    `,
    [tenantId, identityId]
  );
  return r.rowCount > 0;
}

async function resolveTenantScope(app, session, requestedTenantId) {
  const targetTenantId =
    normalizeOptionalText(requestedTenantId) || session.tenant_id;
  if (targetTenantId === session.tenant_id) {
    return { ok: true, tenantId: targetTenantId };
  }

  const exec = await isAdminExec(app, session.tenant_id, session.identity_id);
  if (exec) {
    return { ok: true, tenantId: targetTenantId, exec: true };
  }

  const access = await hasAdminTenantAccess(
    app,
    session.identity_id,
    targetTenantId
  );
  const portfolio = await hasPortfolioAccess(
    app,
    session.identity_id,
    targetTenantId
  );
  if (!access && !portfolio) {
    return { ok: false, error: "TENANT_ACCESS_REQUIRED" };
  }

  return { ok: true, tenantId: targetTenantId };
}

async function loadDropdownListId(app, tenantId, code) {
  const r = await app.db.query(
    `
    SELECT id
    FROM eip_core.dropdown_list
    WHERE code=$1
      AND is_active=true
      AND (tenant_id=$2 OR tenant_id IS NULL)
    ORDER BY (tenant_id IS NOT NULL) DESC, version DESC
    LIMIT 1
    `,
    [code, tenantId]
  );
  return r.rows[0]?.id ?? null;
}

async function loadDropdownValues(app, tenantId, code) {
  const listId = await loadDropdownListId(app, tenantId, code);
  if (!listId) return [];
  const r = await app.db.query(
    `
    SELECT code, label, attrs
    FROM eip_core.dropdown_value
    WHERE list_id=$1 AND is_active=true
    ORDER BY sort_order ASC, code ASC
    `,
    [listId]
  );
  return r.rows || [];
}

function buildNodeMap(graph) {
  const nodes = graph && typeof graph === "object" ? graph.nodes : null;
  if (!nodes) return {};
  if (Array.isArray(nodes)) {
    const map = {};
    for (const node of nodes) {
      if (!node || typeof node !== "object") continue;
      const id = normalizeOptionalText(node.id || node.key || node.name);
      if (id) map[id] = { ...node, id };
    }
    return map;
  }
  if (typeof nodes === "object") {
    const map = {};
    for (const [key, node] of Object.entries(nodes)) {
      if (!node || typeof node !== "object") continue;
      const id = normalizeOptionalText(node.id || key);
      if (id) map[id] = { ...node, id };
    }
    return map;
  }
  return {};
}

function collectTransitions(graph) {
  return Array.isArray(graph?.transitions) ? graph.transitions : [];
}

function buildAdjacency(nodes, transitions) {
  const outgoing = {};
  const incoming = {};
  Object.keys(nodes).forEach((id) => {
    outgoing[id] = [];
    incoming[id] = [];
  });
  for (const t of transitions) {
    if (!t) continue;
    const from = normalizeOptionalText(t.from);
    const to = normalizeOptionalText(t.to || t.target);
    if (!from || !to || !nodes[from] || !nodes[to]) continue;
    outgoing[from].push(to);
    incoming[to].push(from);
  }
  return { outgoing, incoming };
}

function detectCycles(nodes, outgoing) {
  const visited = new Set();
  const stack = new Set();
  const errors = [];

  function dfs(nodeId) {
    if (stack.has(nodeId)) {
      errors.push(`CYCLE_DETECTED:${nodeId}`);
      return;
    }
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    stack.add(nodeId);
    for (const next of outgoing[nodeId] || []) {
      dfs(next);
    }
    stack.delete(nodeId);
  }

  for (const nodeId of Object.keys(nodes)) {
    if (!visited.has(nodeId)) dfs(nodeId);
  }
  return errors;
}

function reachableJoinNodes(startId, nodes, outgoing, cache) {
  if (cache[startId]) return cache[startId];
  const joinIds = new Set();
  const visited = new Set();
  const queue = [startId];
  while (queue.length) {
    const current = queue.shift();
    if (visited.has(current)) continue;
    visited.add(current);
    const nodeType = normalizeUpper(nodes[current]?.type);
    if (nodeType === "JOIN") joinIds.add(current);
    for (const next of outgoing[current] || []) {
      if (!visited.has(next)) queue.push(next);
    }
  }
  cache[startId] = joinIds;
  return joinIds;
}

async function validateTaskTemplateAttrs(app, tenantId, attrs) {
  const errors = [];
  const allowedActions = await loadDropdownValues(app, tenantId, TASK_ACTION_LIST);
  const actionSet = new Set(allowedActions.map((item) => item.code));

  const actions =
    Array.isArray(attrs?.allowed_actions)
      ? attrs.allowed_actions
      : Array.isArray(attrs?.allowedActions)
        ? attrs.allowedActions
        : [];
  for (const action of actions) {
    if (!actionSet.has(String(action || "").trim())) {
      errors.push(`INVALID_TASK_ACTION:${action}`);
    }
  }

  const completion = normalizeOptionalText(attrs?.completion_action || attrs?.completionAction);
  if (completion && !actionSet.has(completion)) {
    errors.push(`INVALID_COMPLETION_ACTION:${completion}`);
  }

  return errors;
}

async function validateProcessGraph(app, tenantId, processDefId, graph, attrs) {
  const errors = [];

  if (!graph || typeof graph !== "object") {
    return { ok: false, errors: ["GRAPH_REQUIRED"] };
  }

  const nodes = buildNodeMap(graph);
  if (Object.keys(nodes).length === 0) errors.push("NODES_REQUIRED");

  const initialNode = normalizeOptionalText(graph.initial_node || graph.initialNode);
  if (!initialNode) errors.push("INITIAL_NODE_REQUIRED");
  if (initialNode && !nodes[initialNode]) errors.push("INITIAL_NODE_NOT_FOUND");

  const transitions = collectTransitions(graph);
  const { outgoing, incoming } = buildAdjacency(nodes, transitions);

  const nodeTypes = await loadDropdownValues(app, tenantId, PROCESS_NODE_TYPE_LIST);
  const edgeTypes = await loadDropdownValues(app, tenantId, PROCESS_EDGE_TYPE_LIST);
  const effectTypes = await loadDropdownValues(app, tenantId, PROCESS_EFFECT_TYPE_LIST);
  const actionTypes = await loadDropdownValues(app, tenantId, PROCESS_ACTION_LIST);
  const nodeTypeSet = new Set(nodeTypes.map((item) => item.code));
  const edgeTypeSet = new Set(edgeTypes.map((item) => item.code));
  const effectTypeSet = new Set(effectTypes.map((item) => item.code));
  const actionTypeSet = new Set(actionTypes.map((item) => normalizeUpper(item.code)));

  for (const node of Object.values(nodes)) {
    const type = normalizeUpper(node.type || node.node_type);
    if (!type) {
      errors.push(`NODE_TYPE_REQUIRED:${node.id}`);
    } else if (!nodeTypeSet.has(type)) {
      errors.push(`NODE_TYPE_INVALID:${node.id}:${type}`);
    }
  }

  for (const t of transitions) {
    if (!t) continue;
    const from = normalizeOptionalText(t.from);
    const to = normalizeOptionalText(t.to || t.target);
    const action = normalizeOptionalText(t.action);
    const edgeType = normalizeUpper(t.edge_type || t.edgeType || "DEFAULT");

    if (!from || !nodes[from]) errors.push(`TRANSITION_FROM_INVALID:${from || "?"}`);
    if (!to || !nodes[to]) errors.push(`TRANSITION_TO_INVALID:${to || "?"}`);
    if (!action) errors.push(`TRANSITION_ACTION_REQUIRED:${from || "?"}`);
    if (action && actionTypeSet.size > 0 && !actionTypeSet.has(normalizeUpper(action))) {
      errors.push(`ACTION_TYPE_INVALID:${from || "?"}:${action}`);
    }
    if (!edgeTypeSet.has(edgeType)) errors.push(`EDGE_TYPE_INVALID:${from || "?"}:${edgeType}`);

    const effects = Array.isArray(t.effects) ? t.effects : [];
    for (const effect of effects) {
      const rawType = normalizeOptionalText(effect?.type);
      if (!rawType) {
        errors.push(`EFFECT_TYPE_REQUIRED:${from || "?"}`);
        continue;
      }
      const type = normalizeUpper(rawType);
      if (!effectTypeSet.has(type)) {
        errors.push(`EFFECT_TYPE_INVALID:${type}`);
      }

      if (type === "STATUS_SET") {
        const toStatus = normalizeOptionalText(effect?.to);
        if (!toStatus) errors.push("STATUS_SET_TO_REQUIRED");
      }
      if (type === "TASK_CREATE") {
        if (!normalizeOptionalText(effect?.task_type)) errors.push("TASK_CREATE_TASK_TYPE_REQUIRED");
      }
      if (type === "TASK_UPDATE" || type === "TASK_STATUS") {
        if (!normalizeOptionalText(effect?.task_id)) errors.push("TASK_UPDATE_TASK_ID_REQUIRED");
      }
      if (type === "LINK_CREATE" || type === "LINK_REMOVE" || type === "LINK") {
        if (!normalizeOptionalText(effect?.src_kind)) errors.push("LINK_SRC_KIND_REQUIRED");
        if (!normalizeOptionalText(effect?.dst_kind)) errors.push("LINK_DST_KIND_REQUIRED");
        if (!normalizeOptionalText(effect?.relation_type)) errors.push("LINK_RELATION_REQUIRED");
        if (!normalizeOptionalText(effect?.src_id)) errors.push("LINK_SRC_ID_REQUIRED");
        if (!normalizeOptionalText(effect?.dst_id)) errors.push("LINK_DST_ID_REQUIRED");
      }
      if (type === "JSON_MERGE" || type === "ATTRS_MERGE") {
        if (!normalizeOptionalText(effect?.target)) errors.push("JSON_MERGE_TARGET_REQUIRED");
        const value = effect?.value ?? effect?.attrs;
        if (!value || typeof value !== "object") errors.push("JSON_MERGE_VALUE_REQUIRED");
      }
      if (type === "CHILD_SERVICE_OBJECT_CREATE" || type === "SO_CREATE") {
        const item = Array.isArray(effect?.items) ? effect.items[0] : effect;
        if (!normalizeOptionalText(item?.object_type || item?.objectType)) {
          errors.push("SO_CREATE_OBJECT_TYPE_REQUIRED");
        }
      }
        if (type === "INFO_RECORD_WRITE") {
          if (!normalizeOptionalText(effect?.record_type)) errors.push("INFO_RECORD_TYPE_REQUIRED");
        }
        if (type === "HTTP_REQUEST" || type === "API_CALL") {
          if (
            !normalizeOptionalText(effect?.connection_code) &&
            !normalizeOptionalText(effect?.gateway_connection_code) &&
            !normalizeOptionalText(effect?.connection)
          ) {
            errors.push("HTTP_REQUEST_CONNECTION_REQUIRED");
          }
          if (!normalizeOptionalText(effect?.url) && !normalizeOptionalText(effect?.endpoint)) {
            errors.push("HTTP_REQUEST_URL_REQUIRED");
          }
        }
        if (type === "ACCESS_GRANT_CREATE") {
        if (!normalizeOptionalText(effect?.grant_type)) errors.push("ACCESS_GRANT_TYPE_REQUIRED");
        if (
          !normalizeOptionalText(effect?.token_hash) &&
          !normalizeOptionalText(effect?.token_raw) &&
          !(effect?.allow_missing === true)
        ) {
          errors.push("ACCESS_GRANT_TOKEN_REQUIRED");
        }
      }
      if (type === "INVENTORY_MOVE" || type === "INVENTORY_CONSUME") {
        if (
          !normalizeOptionalText(effect?.material_lot_id) &&
          !normalizeOptionalText(effect?.lot_id) &&
          !normalizeOptionalText(effect?.material_lot_code) &&
          !normalizeOptionalText(effect?.lot_code)
        ) {
          errors.push("MATERIAL_LOT_ID_REQUIRED");
        }
      }
      if (type === "INVENTORY_PRODUCE") {
        if (
          !normalizeOptionalText(effect?.material_id) &&
          !normalizeOptionalText(effect?.material_code)
        ) {
          errors.push("MATERIAL_ID_REQUIRED");
        }
        if (effect?.quantity === undefined || effect?.quantity === null) {
          errors.push("INVENTORY_QUANTITY_REQUIRED");
        }
      }
      if (type === "INVENTORY_CONVERT") {
        if (
          !normalizeOptionalText(effect?.input_lot_id) &&
          !normalizeOptionalText(effect?.material_lot_id) &&
          !normalizeOptionalText(effect?.lot_id)
        ) {
          errors.push("MATERIAL_LOT_ID_REQUIRED");
        }
        if (
          !normalizeOptionalText(effect?.output_material_id) &&
          !normalizeOptionalText(effect?.output_material_code)
        ) {
          errors.push("OUTPUT_MATERIAL_REQUIRED");
        }
        if (effect?.output_quantity === undefined || effect?.output_quantity === null) {
          errors.push("INVENTORY_QUANTITY_REQUIRED");
        }
      }
      if (type === "ACCESS_GRANT_UPDATE") {
        if (!normalizeOptionalText(effect?.grant_id) && !normalizeOptionalText(effect?.token_hash)) {
          errors.push("ACCESS_GRANT_KEY_REQUIRED");
        }
      }
    }
  }

  // Branching rules
  for (const [nodeId, targets] of Object.entries(outgoing)) {
    if (targets.length <= 1) continue;
    const nodeType = normalizeUpper(nodes[nodeId]?.type || nodes[nodeId]?.node_type);
    if (nodeType !== "ROUTER") {
      errors.push(`BRANCH_REQUIRES_ROUTER:${nodeId}`);
    }
  }

  for (const [nodeId, sources] of Object.entries(incoming)) {
    const nodeType = normalizeUpper(nodes[nodeId]?.type || nodes[nodeId]?.node_type);
    if (nodeType === "JOIN" && sources.length < 2) {
      errors.push(`JOIN_REQUIRES_MULTIPLE_INCOMING:${nodeId}`);
    }
  }

  // Router join enforcement (no implicit merges)
  const joinCache = {};
  for (const [nodeId, targets] of Object.entries(outgoing)) {
    const nodeType = normalizeUpper(nodes[nodeId]?.type || nodes[nodeId]?.node_type);
    if (nodeType !== "ROUTER" || targets.length <= 1) continue;

    const branchJoins = targets.map((target) =>
      reachableJoinNodes(target, nodes, outgoing, joinCache)
    );
    const intersection = branchJoins.reduce((acc, set) => {
      if (!acc) return new Set(set);
      return new Set([...acc].filter((id) => set.has(id)));
    }, null);
    if (!intersection || intersection.size === 0) {
      errors.push(`ROUTER_NO_JOIN:${nodeId}`);
    }
  }

  const cycles = detectCycles(nodes, outgoing);
  errors.push(...cycles);

  // Task template references
  const graphObjectType =
    normalizeOptionalText(graph.object_type) ||
    normalizeOptionalText(attrs?.object_type);
  const templateRes = await app.db.query(
    `
    SELECT task_type, service_object_type
    FROM eip_core.task_template
    WHERE tenant_id=$1 AND process_def_id=$2 AND is_active=true
    `,
    [tenantId, processDefId]
  );
  const templateRows = templateRes.rows || [];

  function templateExists(taskType) {
    return templateRows.some((row) => {
      if (row.task_type !== taskType) return false;
      if (!graphObjectType) return true;
      if (!row.service_object_type) return true;
      return row.service_object_type === graphObjectType;
    });
  }

  for (const node of Object.values(nodes)) {
    const nodeType = normalizeUpper(node.type || node.node_type);
    if (nodeType !== "HUMAN_TASK") continue;
    const onEnter = node.on_enter || node.onEnter || {};
    const refs = [];
    if (Array.isArray(onEnter.task_template_types)) {
      refs.push(...onEnter.task_template_types);
    }
    if (Array.isArray(onEnter.task_template_ids)) {
      // IDs are validated by existence below
      refs.push(...onEnter.task_template_ids);
    }
    if (Array.isArray(onEnter.task_templates)) {
      for (const entry of onEnter.task_templates) {
        if (typeof entry === "string") refs.push(entry);
        if (entry && typeof entry === "object" && entry.task_type) refs.push(entry.task_type);
      }
    }

    if (refs.length === 0) {
      errors.push(`HUMAN_TASK_MISSING_TEMPLATE:${node.id}`);
      continue;
    }

    for (const ref of refs) {
      const taskType = normalizeOptionalText(ref);
      if (!taskType) continue;
      if (!templateExists(taskType)) {
        errors.push(`TASK_TEMPLATE_MISSING:${node.id}:${taskType}`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export default async function coreProcessRoutes(app) {
  const DEF_READ = ["PROCESS_DEF_READ", "CRM_PROCESS_DEF_READ"];
  const DEF_WRITE = ["PROCESS_DEF_WRITE", "CRM_PROCESS_DEF_WRITE"];
  const INSTANCE_READ = ["PROCESS_INSTANCE_READ", "CRM_PROCESS_DEF_READ", "CRM_PROCESS_DEF_WRITE"];
  const INSTANCE_WRITE = ["PROCESS_INSTANCE_WRITE", "CRM_PROCESS_DEF_WRITE"];

  // ==========================================================
  // Process definitions
  // ==========================================================
  app.get("/process/taxonomy", async (req, reply) => {
    const session = await requirePerm(app, req, reply, DEF_READ);
    if (!session) return;

    const scope = await resolveTenantScope(app, session, req.query?.tenant_id);
    if (!scope.ok) {
      return reply.code(403).send({ ok: false, error: scope.error });
    }
    const tenantId = scope.tenantId;

    const codes = String(req.query?.codes || "").split(",").map((c) => c.trim()).filter(Boolean);
    const targetCodes = codes.length
      ? codes
      : [
          PROCESS_NODE_TYPE_LIST,
          PROCESS_EDGE_TYPE_LIST,
          PROCESS_EFFECT_TYPE_LIST,
          PROCESS_ACTION_LIST,
          TASK_ACTION_LIST,
          "TASK_STATUS",
          "SERVICE_OBJECT_STATUS"
        ];

    const lists = {};
    for (const code of targetCodes) {
      lists[code] = await loadDropdownValues(app, tenantId, code);
    }
    return reply.send({ ok: true, lists });
  });
  app.get(
    "/process/defs",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            module: { type: "string", maxLength: 50 },
            object_type: { type: "string", maxLength: 64 },
            is_published: { type: "string", maxLength: 10 },
            tenant_id: { type: "string", minLength: 36, maxLength: 36 },
            limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, DEF_READ);
      if (!session) return;

      const scope = await resolveTenantScope(app, session, req.query?.tenant_id);
      if (!scope.ok) {
        return reply.code(403).send({ ok: false, error: scope.error });
      }

      const tenantId = scope.tenantId;
      const module = normalizeOptionalText(req.query?.module);
      const objectType = normalizeOptionalText(req.query?.object_type);
      const isPublished = normalizeOptionalText(req.query?.is_published);
      const limit = clampLimit(req.query?.limit);
      const offset = Number(req.query?.offset || 0);

      const params = [tenantId];
      const filters = ["tenant_id=$1"];

      if (module) {
        params.push(module);
        filters.push(`attrs->>'module' = $${params.length}`);
      }
      if (objectType) {
        params.push(objectType);
        filters.push(
          `COALESCE(graph->>'object_type', attrs->>'object_type') = $${params.length}`
        );
      }
      if (isPublished !== null) {
        params.push(isPublished.toLowerCase() === "true");
        filters.push(
          `COALESCE((attrs->>'is_published')::boolean,false) = $${params.length}`
        );
      }

      params.push(limit);
      params.push(offset);

      const r = await app.db.query(
        `
        SELECT id, code, name, version, is_active, graph, attrs, created_at, updated_at
        FROM eip_core.process_def
        WHERE ${filters.join(" AND ")}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
        `,
        params
      );

      return reply.send({ ok: true, items: r.rows, limit, offset });
    }
  );

  app.post(
    "/process/defs",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["code", "name"],
          properties: {
            module: { type: "string", maxLength: 50 },
            code: { type: "string", minLength: 2, maxLength: 64 },
            name: { type: "string", minLength: 2, maxLength: 200 },
            version: { type: "integer", minimum: 1 },
            is_active: { type: "boolean" },
            is_published: { type: "boolean" },
            object_type: { type: "string", maxLength: 64 },
            graph: { type: "object" },
            attrs: { type: "object" },
            tenant_id: { type: "string", minLength: 36, maxLength: 36 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, DEF_WRITE);
      if (!session) return;

      const scope = await resolveTenantScope(app, session, req.body?.tenant_id);
      if (!scope.ok) {
        return reply.code(403).send({ ok: false, error: scope.error });
      }

      const item = await createDef(app.db, scope.tenantId, req.body || {});
      return reply.send({ ok: true, item });
    }
  );

  app.get(
    "/process/defs/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", minLength: 36, maxLength: 36 } }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, DEF_READ);
      if (!session) return;

      const scope = await resolveTenantScope(app, session, req.query?.tenant_id);
      if (!scope.ok) {
        return reply.code(403).send({ ok: false, error: scope.error });
      }

      const r = await app.db.query(
        `
        SELECT id, code, name, version, is_active, graph, attrs, created_at, updated_at
        FROM eip_core.process_def
        WHERE tenant_id=$1 AND id=$2
        `,
        [scope.tenantId, req.params.id]
      );
      if (r.rowCount === 0) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
      return reply.send({ ok: true, item: r.rows[0] });
    }
  );

  app.patch(
    "/process/defs/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", minLength: 36, maxLength: 36 } }
        },
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            module: { type: "string", maxLength: 50 },
            name: { type: "string", maxLength: 200 },
            is_active: { type: "boolean" },
            is_published: { type: "boolean" },
            object_type: { type: "string", maxLength: 64 },
            graph: { type: "object" },
            attrs: { type: "object" },
            tenant_id: { type: "string", minLength: 36, maxLength: 36 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, DEF_WRITE);
      if (!session) return;

      const scope = await resolveTenantScope(
        app,
        session,
        req.body?.tenant_id || req.query?.tenant_id
      );
      if (!scope.ok) {
        return reply.code(403).send({ ok: false, error: scope.error });
      }

      const body = req.body || {};
      const module = normalizeOptionalText(body.module);
      const objectType = normalizeOptionalText(body.object_type);
      const attrs = body.attrs && typeof body.attrs === "object" ? body.attrs : null;
      const graph = body.graph && typeof body.graph === "object" ? body.graph : null;

      const mergedAttrs = {
        ...(module ? { module } : {}),
        ...(objectType ? { object_type: objectType } : {}),
        ...(body.is_published !== undefined ? { is_published: body.is_published === true } : {})
      };

      const r = await app.db.query(
        `
        UPDATE eip_core.process_def
        SET name = COALESCE($3, name),
            is_active = COALESCE($4, is_active),
            graph = COALESCE($5::jsonb, graph),
            attrs = COALESCE(attrs,'{}'::jsonb) || COALESCE($6::jsonb, '{}'::jsonb) || COALESCE($7::jsonb, '{}'::jsonb),
            updated_at = now()
        WHERE tenant_id=$1 AND id=$2
        RETURNING id, code, name, version, is_active, graph, attrs, created_at, updated_at
        `,
        [
          scope.tenantId,
          req.params.id,
          normalizeOptionalText(body.name),
          body.is_active !== undefined ? body.is_active : null,
          graph ? JSON.stringify(graph) : null,
          attrs ? JSON.stringify(attrs) : null,
          Object.keys(mergedAttrs).length ? JSON.stringify(mergedAttrs) : null
        ]
      );
      if (r.rowCount === 0) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
      return reply.send({ ok: true, item: r.rows[0] });
    }
  );

  app.post(
    "/process/defs/:id/publish",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", minLength: 36, maxLength: 36 } }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, DEF_WRITE);
      if (!session) return;

      const scope = await resolveTenantScope(app, session, req.query?.tenant_id);
      if (!scope.ok) {
        return reply.code(403).send({ ok: false, error: scope.error });
      }

      const defRes = await app.db.query(
        `
        SELECT id, graph, attrs
        FROM eip_core.process_def
        WHERE tenant_id=$1 AND id=$2
        `,
        [scope.tenantId, req.params.id]
      );
      if (defRes.rowCount === 0) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });

      const validation = await validateProcessGraph(
        app,
        scope.tenantId,
        req.params.id,
        defRes.rows[0].graph || {},
        defRes.rows[0].attrs || {}
      );
      if (!validation.ok) {
        return reply.code(409).send({ ok: false, error: "VALIDATION_FAILED", details: validation.errors });
      }

      const r = await app.db.query(
        `
        UPDATE eip_core.process_def
        SET attrs = COALESCE(attrs,'{}'::jsonb) || jsonb_build_object('is_published', true),
            updated_at = now()
        WHERE tenant_id=$1 AND id=$2
        RETURNING id, code, name, version, is_active, graph, attrs, created_at, updated_at
        `,
        [scope.tenantId, req.params.id]
      );
      if (r.rowCount === 0) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
      return reply.send({ ok: true, item: r.rows[0] });
    }
  );

  app.post(
    "/process/defs/:id/validate",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", minLength: 36, maxLength: 36 } }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, DEF_READ);
      if (!session) return;

      const scope = await resolveTenantScope(app, session, req.query?.tenant_id);
      if (!scope.ok) {
        return reply.code(403).send({ ok: false, error: scope.error });
      }

      const defRes = await app.db.query(
        `
        SELECT id, graph, attrs
        FROM eip_core.process_def
        WHERE tenant_id=$1 AND id=$2
        `,
        [scope.tenantId, req.params.id]
      );
      if (defRes.rowCount === 0) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });

      const validation = await validateProcessGraph(
        app,
        scope.tenantId,
        req.params.id,
        defRes.rows[0].graph || {},
        defRes.rows[0].attrs || {}
      );
      return reply.send({ ok: true, valid: validation.ok, errors: validation.errors });
    }
  );

  // ==========================================================
  // Process instances
  // ==========================================================
  app.get(
    "/process/instances",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            service_object_id: { type: "string", minLength: 36, maxLength: 36 },
            tenant_id: { type: "string", minLength: 36, maxLength: 36 },
            limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, INSTANCE_READ);
      if (!session) return;

      const scope = await resolveTenantScope(app, session, req.query?.tenant_id);
      if (!scope.ok) {
        return reply.code(403).send({ ok: false, error: scope.error });
      }

      const tenantId = scope.tenantId;
      const serviceObjectId = normalizeOptionalText(req.query?.service_object_id);
      const limit = clampLimit(req.query?.limit);
      const offset = Number(req.query?.offset || 0);

      const params = [tenantId];
      const filters = ["tenant_id=$1"];
      if (serviceObjectId) {
        params.push(serviceObjectId);
        filters.push(`service_object_id=$${params.length}`);
      }

      params.push(limit);
      params.push(offset);

      const r = await app.db.query(
        `
        SELECT id, service_object_id, process_def_id, status, started_at, ended_at, cursor_json, attrs, created_at, updated_at
        FROM eip_core.process_instance
        WHERE ${filters.join(" AND ")}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
        `,
        params
      );

      return reply.send({ ok: true, items: r.rows, limit, offset });
    }
  );

  app.get(
    "/process/instances/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", minLength: 36, maxLength: 36 } }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, INSTANCE_READ);
      if (!session) return;

      const scope = await resolveTenantScope(app, session, req.query?.tenant_id);
      if (!scope.ok) {
        return reply.code(403).send({ ok: false, error: scope.error });
      }

      const r = await app.db.query(
        `
        SELECT id, service_object_id, process_def_id, status, started_at, ended_at, cursor_json, attrs, created_at, updated_at
        FROM eip_core.process_instance
        WHERE tenant_id=$1 AND id=$2
        `,
        [scope.tenantId, req.params.id]
      );
      if (r.rowCount === 0) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
      return reply.send({ ok: true, item: r.rows[0] });
    }
  );

  app.post(
    "/process/instances",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["service_object_id"],
          properties: {
            service_object_id: { type: "string", minLength: 36, maxLength: 36 },
            process_def_id: { type: "string", minLength: 36, maxLength: 36 },
            module: { type: "string", maxLength: 50 },
            code: { type: "string", maxLength: 64 },
            version: { type: "integer", minimum: 1 },
            idempotency_key: { type: "string", maxLength: 200 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, INSTANCE_WRITE);
      if (!session) return;

      const body = req.body || {};

      if (!body.process_def_id && !body.code) {
        return reply.code(400).send({ ok: false, error: "PROCESS_DEF_REQUIRED" });
      }

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");

        const result = await createInstance(client, {
          tenantId: session.tenant_id,
          identityId: session.identity_id,
          serviceObjectId: normalizeText(body.service_object_id),
          processDefId: normalizeOptionalText(body.process_def_id),
          module: normalizeOptionalText(body.module),
          code: normalizeOptionalText(body.code),
          version: Number.isFinite(body.version) ? body.version : null,
          idempotencyKey: normalizeOptionalText(body.idempotency_key)
        });

        if (!result.ok) {
          await client.query("ROLLBACK");
          const status = result.error === "SERVICE_OBJECT_NOT_FOUND" || result.error === "PROCESS_DEF_NOT_FOUND"
            ? 404
            : result.error === "INITIAL_NODE_REQUIRED"
              ? 400
              : 409;
          return reply.code(status).send({ ok: false, error: result.error });
        }

        await client.query("COMMIT");
        return reply.send({ ok: true, item: result.item, reused: result.reused === true });
      } catch (e) {
        await client.query("ROLLBACK");
        app.log.error({ event: "core_process_instance_create_error", tenantId: session.tenant_id, error: e.message });
        return reply.code(500).send({ ok: false });
      } finally {
        client.release();
      }
    }
  );

  app.post(
    "/process/instances/:id/advance",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", minLength: 36, maxLength: 36 } }
        },
        body: {
          type: "object",
          additionalProperties: false,
          required: ["action", "idempotency_key"],
          properties: {
            action: { type: "string", minLength: 1, maxLength: 50 },
            payload: { type: "object" },
            idempotency_key: { type: "string", minLength: 6, maxLength: 200 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, INSTANCE_WRITE);
      if (!session) return;

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");

        const result = await advanceInstance(client, {
          tenantId: session.tenant_id,
          identityId: session.identity_id,
          instanceId: req.params.id,
          action: normalizeText(req.body.action),
          payload: req.body.payload || {},
          idempotencyKey: normalizeText(req.body.idempotency_key)
        });

        if (!result.ok) {
          await client.query("ROLLBACK");
          const status = result.error === "NOT_FOUND" ? 404 : 409;
          return reply.code(status).send({ ok: false, error: result.error });
        }

        await client.query("COMMIT");
        return reply.send({ ok: true, entry: result.entry, reused: result.reused === true });
      } catch (e) {
        await client.query("ROLLBACK");
        app.log.error({ event: "core_process_instance_advance_error", tenantId: session.tenant_id, error: e.message });
        return reply.code(500).send({ ok: false });
      } finally {
        client.release();
      }
    }
  );

  // ==========================================================
  // Task templates
  // ==========================================================
  app.get(
    "/process/task-templates",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            process_def_id: { type: "string", minLength: 36, maxLength: 36 },
            service_object_type: { type: "string", maxLength: 64 },
            is_active: { type: "string", maxLength: 10 },
            tenant_id: { type: "string", minLength: 36, maxLength: 36 },
            limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, DEF_READ);
      if (!session) return;

      const scope = await resolveTenantScope(app, session, req.query?.tenant_id);
      if (!scope.ok) {
        return reply.code(403).send({ ok: false, error: scope.error });
      }

      const tenantId = scope.tenantId;
      const processDefId = normalizeOptionalText(req.query?.process_def_id);
      const serviceObjectType = normalizeOptionalText(req.query?.service_object_type);
      const isActive = normalizeOptionalText(req.query?.is_active);
      const limit = clampLimit(req.query?.limit);
      const offset = Number(req.query?.offset || 0);

      const params = [tenantId];
      const filters = ["tenant_id=$1"];
      if (processDefId) {
        params.push(processDefId);
        filters.push(`process_def_id=$${params.length}`);
      }
      if (serviceObjectType) {
        params.push(serviceObjectType);
        filters.push(`service_object_type=$${params.length}`);
      }
      if (isActive !== null) {
        params.push(isActive.toLowerCase() === "true");
        filters.push(`is_active=$${params.length}`);
      }

      params.push(limit);
      params.push(offset);

      const r = await app.db.query(
        `
        SELECT id, process_def_id, service_object_type, task_type, title, description,
               is_active, sort_order, attrs, created_at, updated_at
        FROM eip_core.task_template
        WHERE ${filters.join(" AND ")}
        ORDER BY sort_order ASC, created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
        `,
        params
      );

      return reply.send({ ok: true, items: r.rows, limit, offset });
    }
  );

  app.post(
    "/process/task-templates",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["process_def_id", "task_type"],
          properties: {
            process_def_id: { type: "string", minLength: 36, maxLength: 36 },
            service_object_type: { type: "string", maxLength: 64 },
            task_type: { type: "string", minLength: 2, maxLength: 100 },
            title: { type: "string", maxLength: 200 },
            description: { type: "string", maxLength: 2000 },
            sort_order: { type: "integer", minimum: 0, maximum: 10000 },
            is_active: { type: "boolean" },
            attrs: { type: "object" },
            tenant_id: { type: "string", minLength: 36, maxLength: 36 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, DEF_WRITE);
      if (!session) return;

      const scope = await resolveTenantScope(app, session, req.body?.tenant_id);
      if (!scope.ok) {
        return reply.code(403).send({ ok: false, error: scope.error });
      }

      const body = req.body || {};
      const attrs = body.attrs && typeof body.attrs === "object" ? body.attrs : {};
      const attrErrors = await validateTaskTemplateAttrs(app, scope.tenantId, attrs);
      if (attrErrors.length) {
        return reply.code(409).send({ ok: false, error: "INVALID_TASK_TEMPLATE", details: attrErrors });
      }

      const r = await app.db.query(
        `
        INSERT INTO eip_core.task_template
          (tenant_id, process_def_id, service_object_type, task_type, title, description,
           is_active, sort_order, attrs)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
        RETURNING id, process_def_id, service_object_type, task_type, title, description,
                  is_active, sort_order, attrs, created_at, updated_at
        `,
        [
          scope.tenantId,
          normalizeText(body.process_def_id),
          normalizeOptionalText(body.service_object_type),
          normalizeText(body.task_type),
          normalizeOptionalText(body.title),
          normalizeOptionalText(body.description),
          body.is_active !== false,
          Number.isFinite(body.sort_order) ? body.sort_order : 100,
          JSON.stringify(attrs)
        ]
      );
      return reply.send({ ok: true, item: r.rows[0] });
    }
  );

  app.patch(
    "/process/task-templates/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", minLength: 36, maxLength: 36 } }
        },
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            service_object_type: { type: "string", maxLength: 64 },
            task_type: { type: "string", minLength: 2, maxLength: 100 },
            title: { type: "string", maxLength: 200 },
            description: { type: "string", maxLength: 2000 },
            sort_order: { type: "integer", minimum: 0, maximum: 10000 },
            is_active: { type: "boolean" },
            attrs: { type: "object" },
            tenant_id: { type: "string", minLength: 36, maxLength: 36 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, DEF_WRITE);
      if (!session) return;

      const scope = await resolveTenantScope(
        app,
        session,
        req.body?.tenant_id || req.query?.tenant_id
      );
      if (!scope.ok) {
        return reply.code(403).send({ ok: false, error: scope.error });
      }

      const body = req.body || {};
      const attrs = body.attrs && typeof body.attrs === "object" ? body.attrs : null;
      if (attrs) {
        const attrErrors = await validateTaskTemplateAttrs(app, scope.tenantId, attrs);
        if (attrErrors.length) {
          return reply.code(409).send({ ok: false, error: "INVALID_TASK_TEMPLATE", details: attrErrors });
        }
      }

      const r = await app.db.query(
        `
        UPDATE eip_core.task_template
        SET service_object_type = COALESCE($3, service_object_type),
            task_type = COALESCE($4, task_type),
            title = COALESCE($5, title),
            description = COALESCE($6, description),
            sort_order = COALESCE($7, sort_order),
            is_active = COALESCE($8, is_active),
            attrs = COALESCE(attrs,'{}'::jsonb) || COALESCE($9::jsonb, '{}'::jsonb),
            updated_at = now()
        WHERE tenant_id=$1 AND id=$2
        RETURNING id, process_def_id, service_object_type, task_type, title, description,
                  is_active, sort_order, attrs, created_at, updated_at
        `,
        [
          scope.tenantId,
          req.params.id,
          normalizeOptionalText(body.service_object_type),
          normalizeOptionalText(body.task_type),
          normalizeOptionalText(body.title),
          normalizeOptionalText(body.description),
          Number.isFinite(body.sort_order) ? body.sort_order : null,
          body.is_active !== undefined ? body.is_active : null,
          attrs ? JSON.stringify(attrs) : null
        ]
      );
      if (r.rowCount === 0) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
      return reply.send({ ok: true, item: r.rows[0] });
    }
  );

  // ==========================================================
  // Process bindings
  // ==========================================================
  app.get(
    "/process/bindings",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            service_object_type: { type: "string", maxLength: 64 },
            process_def_id: { type: "string", minLength: 36, maxLength: 36 },
            is_active: { type: "string", maxLength: 10 },
            tenant_id: { type: "string", minLength: 36, maxLength: 36 },
            limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, DEF_READ);
      if (!session) return;

      const scope = await resolveTenantScope(app, session, req.query?.tenant_id);
      if (!scope.ok) {
        return reply.code(403).send({ ok: false, error: scope.error });
      }

      const tenantId = scope.tenantId;
      const serviceObjectType = normalizeOptionalText(req.query?.service_object_type);
      const processDefId = normalizeOptionalText(req.query?.process_def_id);
      const isActive = normalizeOptionalText(req.query?.is_active);
      const limit = clampLimit(req.query?.limit);
      const offset = Number(req.query?.offset || 0);

      const params = [tenantId];
      const filters = ["tenant_id=$1"];
      if (serviceObjectType) {
        params.push(serviceObjectType);
        filters.push(`service_object_type=$${params.length}`);
      }
      if (processDefId) {
        params.push(processDefId);
        filters.push(`process_def_id=$${params.length}`);
      }
      if (isActive !== null) {
        params.push(isActive.toLowerCase() === "true");
        filters.push(`is_active=$${params.length}`);
      }

      params.push(limit);
      params.push(offset);

      const r = await app.db.query(
        `
        SELECT id, service_object_type, process_def_id, task_type, is_active, priority, attrs,
               created_at, updated_at
        FROM eip_core.process_binding
        WHERE ${filters.join(" AND ")}
        ORDER BY priority ASC, created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
        `,
        params
      );
      return reply.send({ ok: true, items: r.rows, limit, offset });
    }
  );

  app.post(
    "/process/bindings",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["service_object_type", "process_def_id"],
          properties: {
            service_object_type: { type: "string", maxLength: 64 },
            process_def_id: { type: "string", minLength: 36, maxLength: 36 },
            task_type: { type: "string", maxLength: 100 },
            is_active: { type: "boolean" },
            priority: { type: "integer", minimum: 0, maximum: 10000 },
            attrs: { type: "object" },
            tenant_id: { type: "string", minLength: 36, maxLength: 36 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, DEF_WRITE);
      if (!session) return;

      const scope = await resolveTenantScope(app, session, req.body?.tenant_id);
      if (!scope.ok) {
        return reply.code(403).send({ ok: false, error: scope.error });
      }

      const body = req.body || {};
      const attrs = body.attrs && typeof body.attrs === "object" ? body.attrs : {};

      const r = await app.db.query(
        `
        INSERT INTO eip_core.process_binding
          (tenant_id, service_object_type, process_def_id, task_type, is_active, priority, attrs)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7::jsonb)
        RETURNING id, service_object_type, process_def_id, task_type, is_active, priority, attrs,
                  created_at, updated_at
        `,
        [
          scope.tenantId,
          normalizeText(body.service_object_type),
          normalizeText(body.process_def_id),
          normalizeOptionalText(body.task_type),
          body.is_active !== false,
          Number.isFinite(body.priority) ? body.priority : 100,
          JSON.stringify(attrs)
        ]
      );
      return reply.send({ ok: true, item: r.rows[0] });
    }
  );

  app.patch(
    "/process/bindings/:id",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", minLength: 36, maxLength: 36 } }
        },
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            service_object_type: { type: "string", maxLength: 64 },
            process_def_id: { type: "string", minLength: 36, maxLength: 36 },
            task_type: { type: "string", maxLength: 100 },
            is_active: { type: "boolean" },
            priority: { type: "integer", minimum: 0, maximum: 10000 },
            attrs: { type: "object" },
            tenant_id: { type: "string", minLength: 36, maxLength: 36 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, DEF_WRITE);
      if (!session) return;

      const scope = await resolveTenantScope(
        app,
        session,
        req.body?.tenant_id || req.query?.tenant_id
      );
      if (!scope.ok) {
        return reply.code(403).send({ ok: false, error: scope.error });
      }

      const body = req.body || {};
      const attrs = body.attrs && typeof body.attrs === "object" ? body.attrs : null;

      const r = await app.db.query(
        `
        UPDATE eip_core.process_binding
        SET service_object_type = COALESCE($3, service_object_type),
            process_def_id = COALESCE($4, process_def_id),
            task_type = COALESCE($5, task_type),
            is_active = COALESCE($6, is_active),
            priority = COALESCE($7, priority),
            attrs = COALESCE(attrs,'{}'::jsonb) || COALESCE($8::jsonb, '{}'::jsonb),
            updated_at = now()
        WHERE tenant_id=$1 AND id=$2
        RETURNING id, service_object_type, process_def_id, task_type, is_active, priority, attrs,
                  created_at, updated_at
        `,
        [
          scope.tenantId,
          req.params.id,
          normalizeOptionalText(body.service_object_type),
          normalizeOptionalText(body.process_def_id),
          normalizeOptionalText(body.task_type),
          body.is_active !== undefined ? body.is_active : null,
          Number.isFinite(body.priority) ? body.priority : null,
          attrs ? JSON.stringify(attrs) : null
        ]
      );
      if (r.rowCount === 0) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
      return reply.send({ ok: true, item: r.rows[0] });
    }
  );
}
