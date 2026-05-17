// services/api/src/routes/admin_template_clone.js
import { hasPermission } from "../auth/perm.js";

function normalizeText(value) {
  return String(value || "").trim();
}

async function requireAdminPerm(app, req, reply, permCode, opts = {}) {
  const guard = opts.csrf
    ? await app.requireCsrf(req)
    : await app.requireSession(req, { realm: "EIP" });
  if (!guard.ok) {
    reply.code(guard.status).send({ ok: false, error: guard.error });
    return null;
  }
  const session = req.session || guard.session;
  const allowed = await hasPermission(app, session.tenant_id, session.identity_id, permCode);
  if (!allowed) {
    reply.code(403).send({ ok: false, error: "FORBIDDEN" });
    return null;
  }
  return session;
}

function buildTenantSearch(query, { includeTemplates }) {
  const params = [];
  const where = ["is_active = true"];
  if (includeTemplates) {
    where.push("attrs->>'template' = 'true'");
  } else {
    where.push("(attrs->>'template' IS NULL OR attrs->>'template' <> 'true')");
  }
  if (query) {
    params.push(`%${query}%`);
    const idx = params.length;
    where.push(
      `(code ILIKE $${idx} OR name ILIKE $${idx} OR id::text ILIKE $${idx})`
    );
  }
  return { where, params };
}

export default async function adminTemplateCloneRoutes(app) {
  app.get("/admin/template-tenants", async (req, reply) => {
    const session = await requireAdminPerm(app, req, reply, "admin.template.read");
    if (!session) return;

    const query = normalizeText(req.query?.query);
    const { where, params } = buildTenantSearch(query, { includeTemplates: true });
    const r = await app.db.query(
      `
      SELECT id, code, name
      FROM eip_core.tenant
      WHERE ${where.join(" AND ")}
      ORDER BY name
      LIMIT 200
      `,
      params
    );

    return reply.send({ ok: true, tenants: r.rows || [] });
  });

  app.get("/admin/tenant-lookup", async (req, reply) => {
    const session = await requireAdminPerm(app, req, reply, "admin.template.read");
    if (!session) return;

    const query = normalizeText(req.query?.query);
    const { where, params } = buildTenantSearch(query, { includeTemplates: false });
    const r = await app.db.query(
      `
      SELECT id, code, name
      FROM eip_core.tenant
      WHERE ${where.join(" AND ")}
      ORDER BY name
      LIMIT 200
      `,
      params
    );

    return reply.send({ ok: true, tenants: r.rows || [] });
  });

  app.post("/admin/template-clone", async (req, reply) => {
    const session = await requireAdminPerm(app, req, reply, "admin.template.clone", {
      csrf: true,
    });
    if (!session) return;

    const sourceId = normalizeText(req.body?.source_tenant_id || req.body?.sourceTenantId);
    const targetId = normalizeText(req.body?.target_tenant_id || req.body?.targetTenantId);
    if (!sourceId || !targetId) {
      return reply.code(400).send({ ok: false, error: "TENANT_REQUIRED" });
    }
    if (sourceId === targetId) {
      return reply.code(409).send({ ok: false, error: "SOURCE_EQUALS_TARGET" });
    }

    const client = await app.db.connect();
    try {
      await client.query("BEGIN");

      const sourceRes = await client.query(
        `
        SELECT id, code, name, (attrs->>'template' = 'true') AS is_template
        FROM eip_core.tenant
        WHERE id = $1
        LIMIT 1
        `,
        [sourceId]
      );
      if (sourceRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "SOURCE_TENANT_NOT_FOUND" });
      }
      if (!sourceRes.rows[0].is_template) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: "SOURCE_NOT_TEMPLATE" });
      }

      const targetRes = await client.query(
        `
        SELECT id, code, name, (attrs->>'template' = 'true') AS is_template
        FROM eip_core.tenant
        WHERE id = $1
        LIMIT 1
        `,
        [targetId]
      );
      if (targetRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "TARGET_TENANT_NOT_FOUND" });
      }
      if (targetRes.rows[0].is_template) {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: "TARGET_IS_TEMPLATE" });
      }

      const summary = {};

      let r = await client.query(
        `
        INSERT INTO eip_core.dropdown_list (tenant_id, module, code, name, version, is_active, attrs)
        SELECT $1, module, code, name, version, is_active, attrs
        FROM eip_core.dropdown_list
        WHERE tenant_id = $2
        ON CONFLICT (tenant_id, module, code, version) DO NOTHING
        `,
        [targetId, sourceId]
      );
      summary.dropdown_lists = r.rowCount;

      r = await client.query(
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
        ON CONFLICT (list_id, code) DO NOTHING
        `,
        [targetId, sourceId]
      );
      summary.dropdown_values = r.rowCount;

      r = await client.query(
        `
        INSERT INTO eip_core.schema_registry
          (tenant_id, module, object_kind, object_type, version, is_active, schema_json, ui_json)
        SELECT
          $1, module, object_kind, object_type, version, is_active, schema_json, ui_json
        FROM eip_core.schema_registry
        WHERE tenant_id = $2
        ON CONFLICT (tenant_id, module, object_kind, object_type, version) DO NOTHING
        `,
        [targetId, sourceId]
      );
      summary.schema_registry = r.rowCount;

      r = await client.query(
        `
        INSERT INTO eip_core.schema_bundle
          (tenant_id, module, version, is_published, bundle_json, etag)
        SELECT
          $1, module, version, is_published, bundle_json, etag
        FROM eip_core.schema_bundle
        WHERE tenant_id = $2
        ON CONFLICT (tenant_id, module, version) DO NOTHING
        `,
        [targetId, sourceId]
      );
      summary.schema_bundles = r.rowCount;

      r = await client.query(
        `
        INSERT INTO eip_core.process_def
          (tenant_id, code, name, version, is_active, graph, attrs)
        SELECT
          $1, code, name, version, is_active, graph, attrs
        FROM eip_core.process_def
        WHERE tenant_id = $2
        ON CONFLICT (tenant_id, code, version) DO NOTHING
        `,
        [targetId, sourceId]
      );
      summary.process_defs = r.rowCount;

      r = await client.query(
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
        JOIN eip_core.process_def tgt_def
          ON tgt_def.tenant_id = $1
         AND tgt_def.code = src_def.code
         AND tgt_def.version = src_def.version
        ON CONFLICT (tenant_id, process_def_id, COALESCE(service_object_type, ''), task_type) DO NOTHING
        `,
        [targetId, sourceId]
      );
      summary.task_templates = r.rowCount;

      r = await client.query(
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
        JOIN eip_core.process_def tgt_def
          ON tgt_def.tenant_id = $1
         AND tgt_def.code = src_def.code
         AND tgt_def.version = src_def.version
        ON CONFLICT (tenant_id, service_object_type, process_def_id, COALESCE(task_type, '')) DO NOTHING
        `,
        [targetId, sourceId]
      );
      summary.process_bindings = r.rowCount;

      r = await client.query(
        `
        INSERT INTO eip_core.ui_surface
          (tenant_id, code, title, version, is_active, is_published, is_public, tree, attrs)
        SELECT
          $1, code, title, version, is_active, is_published, is_public, tree, attrs
        FROM eip_core.ui_surface
        WHERE tenant_id = $2
        ON CONFLICT (tenant_id, code, version) DO NOTHING
        `,
        [targetId, sourceId]
      );
      summary.ui_surfaces = r.rowCount;

      r = await client.query(
        `
        INSERT INTO eip_core.commercial_condition
          (tenant_id, code, label, condition_type, condition_category, priority, valid_from, valid_to, is_active, scope, effect, attrs)
        SELECT
          $1, code, label, condition_type, condition_category, priority, valid_from, valid_to, is_active, scope, effect, attrs
        FROM eip_core.commercial_condition
        WHERE tenant_id = $2
        ON CONFLICT (tenant_id, code) DO NOTHING
        `,
        [targetId, sourceId]
      );
      summary.commercial_conditions = r.rowCount;

      await client.query("COMMIT");

      return reply.send({
        ok: true,
        source: sourceRes.rows[0],
        target: targetRes.rows[0],
        summary,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      app.log.error({ err }, "template_clone_failed");
      return reply.code(500).send({ ok: false, error: "CLONE_FAILED" });
    } finally {
      client.release();
    }
  });
}
