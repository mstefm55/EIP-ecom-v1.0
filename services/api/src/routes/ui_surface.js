import { isAuthenticatedSurfaceAllowed, resolveEipSurfaceAccess } from "../lib/surfaceAccess.js";
import {
  buildCommandCenterPayload,
  delegateCommandCenterTask,
  scheduleCommandCenterTask
} from "../services/dashboard/commandCenter.js";

const OPEN_TASK_STATUSES = ["open", "assigned", "in_progress", "blocked", "pending"];
const DEFAULT_UI_LANGUAGE_PACK = {
  id: "eip-dashboard-language-pack",
  version: "eip-dashboard-i18n-v1",
  source_locale: "en",
  supported_locales: ["en", "ru", "fr", "ky", "es", "de"],
  source: "api_default_metadata",
  translations: {},
  component_metadata: {
    shell: { key: "shell", version: "shell.i18n.v1" },
    sidebar: { key: "sidebar", version: "sidebar.i18n.v1" },
    auth: { key: "auth", version: "auth.i18n.v1" },
    admin: { key: "admin", version: "admin.i18n.v1" },
    tenantDashboard: { key: "tenantDashboard", version: "tenant-dashboard.i18n.v1" },
    contentStudio: { key: "contentStudio", version: "content-studio.i18n.v1" },
    commerce: { key: "commerce", version: "commerce.i18n.v1" },
    commonControls: { key: "commonControls", version: "common-controls.i18n.v1" }
  }
};

function normalizeText(value) {
  return String(value || "").trim();
}

function buildEtag(surface) {
  const updated = surface.updated_at || surface.created_at || new Date().toISOString();
  return `W/\"${surface.id}:${surface.version}:${updated}\"`;
}

function sendSurface(req, reply, surface, cacheControl) {
  const etag = buildEtag(surface);
  const ifNoneMatch = String(req.headers["if-none-match"] || "");
  const lastModified = surface.updated_at || surface.created_at;

  reply.header("ETag", etag);
  if (lastModified) {
    reply.header("Last-Modified", new Date(lastModified).toUTCString());
  }
  if (cacheControl) {
    reply.header("Cache-Control", cacheControl);
  }

  if (ifNoneMatch && ifNoneMatch === etag) {
    return reply.code(304).send();
  }

  return reply.send({ ok: true, surface });
}

async function resolveTenantId(app, { tenantId, tenantCode }) {
  if (tenantId) return tenantId;
  if (!tenantCode) return null;
  const r = await app.db.query(
    `
    SELECT id
    FROM eip_core.tenant
    WHERE code = $1
    LIMIT 1
    `,
    [tenantCode]
  );
  return r.rows[0]?.id ?? null;
}

async function fetchSurface(app, { code, tenantId, publicOnly }) {
  const params = [code];
  let tenantFilter = "tenant_id IS NULL";
  if (tenantId) {
    params.push(tenantId);
    tenantFilter = "(tenant_id = $2 OR tenant_id IS NULL)";
  }

  const publicFilter = publicOnly ? "AND is_public = true" : "";

  const r = await app.db.query(
    `
    SELECT id, tenant_id, code, title, version, is_active, is_published, is_public, tree, attrs
    FROM eip_core.ui_surface
    WHERE code = $1
      AND is_active = true
      AND is_published = true
      AND ${tenantFilter}
      ${publicFilter}
    ORDER BY (tenant_id IS NOT NULL) DESC, version DESC
    LIMIT 1
    `,
    params
  );

  return r.rows[0] || null;
}

function uniqueStrings(values) {
  return [...new Set((values || []).map(normalizeText).filter(Boolean))];
}

function moduleFromSurface(row) {
  const attrs = row?.attrs && typeof row.attrs === "object" ? row.attrs : {};
  return normalizeText(attrs.module || attrs.surface_group || attrs.area || row.code);
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeLanguagePack(base = DEFAULT_UI_LANGUAGE_PACK, override = {}) {
  const output = {
    ...base,
    ...(isObject(override) ? override : {}),
    translations: { ...(base.translations || {}) },
    component_metadata: { ...(base.component_metadata || {}) }
  };
  if (isObject(override?.translations)) {
    for (const [locale, messages] of Object.entries(override.translations)) {
      output.translations[locale] = {
        ...(output.translations[locale] || {}),
        ...(isObject(messages) ? messages : {})
      };
    }
  }
  if (isObject(override?.component_metadata)) {
    for (const [key, metadata] of Object.entries(override.component_metadata)) {
      output.component_metadata[key] = {
        ...(output.component_metadata[key] || {}),
        ...(isObject(metadata) ? metadata : {})
      };
    }
  }
  return output;
}

async function loadUiLanguagePack(app, tenantId = null) {
  if (!tenantId) {
    return {
      ...DEFAULT_UI_LANGUAGE_PACK,
      source: "api_default_metadata"
    };
  }
  const r = await app.db.query(
    `
    SELECT attrs, updated_at
    FROM eip_core.tenant_module_setting
    WHERE tenant_id = $1
      AND module = 'ui'
      AND code = 'language_pack'
      AND is_active = true
    LIMIT 1
    `,
    [tenantId]
  );
  const attrs = r.rows[0]?.attrs && typeof r.rows[0].attrs === "object" ? r.rows[0].attrs : null;
  if (!attrs) {
    return {
      ...DEFAULT_UI_LANGUAGE_PACK,
      source: "api_default_metadata"
    };
  }
  const rawPack = attrs.language_pack && typeof attrs.language_pack === "object"
    ? attrs.language_pack
    : attrs;
  return {
    ...mergeLanguagePack(DEFAULT_UI_LANGUAGE_PACK, rawPack),
    source: "tenant_module_setting",
    updated_at: r.rows[0]?.updated_at || null
  };
}

async function buildActiveModules(app, tenantId) {
  const [moduleSettingsRes, surfacesRes] = await Promise.all([
    app.db.query(
      `
      SELECT DISTINCT module
      FROM eip_core.tenant_module_setting
      WHERE tenant_id = $1
        AND is_active = true
      `,
      [tenantId]
    ),
    app.db.query(
      `
      SELECT code, attrs
      FROM eip_core.ui_surface
      WHERE is_active = true
        AND is_published = true
        AND (tenant_id = $1 OR tenant_id IS NULL)
      `,
      [tenantId]
    )
  ]);

  const modulesFromSettings = moduleSettingsRes.rows.map((row) => row.module);
  const modulesFromSurfaces = surfacesRes.rows.map(moduleFromSurface);
  return uniqueStrings([...modulesFromSettings, ...modulesFromSurfaces])
    .map((module) => module.toLowerCase())
    .sort((a, b) => a.localeCompare(b));
}

async function buildDashboardSummary(app, tenantId) {
  const [activeModules, openTasksRes, reportsRes, recentTasksRes, recentReportsRes] = await Promise.all([
    buildActiveModules(app, tenantId),
    app.db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM eip_core.task
      WHERE tenant_id = $1
        AND lower(status) = ANY($2::text[])
      `,
      [tenantId, OPEN_TASK_STATUSES]
    ),
    app.db.query(
      `
      SELECT COUNT(*)::int AS total
      FROM eip_core.info_record
      WHERE tenant_id = $1
        AND (
          lower(record_type) LIKE '%report%'
          OR lower(COALESCE(title, '')) LIKE '%report%'
          OR lower(COALESCE(payload->>'kind', '')) LIKE '%report%'
        )
        AND created_at >= now() - interval '30 days'
      `,
      [tenantId]
    ),
    app.db.query(
      `
      SELECT id, title, status, task_type, due_at, created_at, updated_at
      FROM eip_core.task
      WHERE tenant_id = $1
        AND lower(status) = ANY($2::text[])
      ORDER BY COALESCE(due_at, updated_at, created_at) ASC
      LIMIT 6
      `,
      [tenantId, OPEN_TASK_STATUSES]
    ),
    app.db.query(
      `
      SELECT id, record_type, title, created_at
      FROM eip_core.info_record
      WHERE tenant_id = $1
        AND (
          lower(record_type) LIKE '%report%'
          OR lower(COALESCE(title, '')) LIKE '%report%'
          OR lower(COALESCE(payload->>'kind', '')) LIKE '%report%'
        )
      ORDER BY created_at DESC
      LIMIT 6
      `,
      [tenantId]
    )
  ]);

  return {
    ok: true,
    stats: {
      active_modules: activeModules.length,
      open_tasks: Number(openTasksRes.rows?.[0]?.total || 0),
      recent_reports: Number(reportsRes.rows?.[0]?.total || 0)
    },
    active_modules: activeModules,
    open_task_statuses: OPEN_TASK_STATUSES,
    recent_tasks: recentTasksRes.rows || [],
    recent_reports: recentReportsRes.rows || []
  };
}

export default async function uiSurfaceRoutes(app, opts = {}) {
  const isPublic = opts.public === true;

  if (isPublic) {
    // Public surfaces (e.g., auth)
    app.get(
      "/ui/language-pack",
      {
        config: {
          rateLimit: { max: 60, timeWindow: "1 minute" },
          cors: { origin: app.PUBLIC_ORIGINS, credentials: false }
        },
        schema: {
          querystring: {
            type: "object",
            additionalProperties: false,
            properties: {
              tenant_id: { type: "string", minLength: 36, maxLength: 36 },
              tenant_code: { type: "string", maxLength: 64 }
            }
          }
        }
      },
      async (req, reply) => {
        const tenantId = await resolveTenantId(app, {
          tenantId: normalizeText(req.query?.tenant_id),
          tenantCode: normalizeText(req.query?.tenant_code),
        });
        const languagePack = await loadUiLanguagePack(app, tenantId);
        return reply
          .header("Cache-Control", "public, max-age=60")
          .send({ ok: true, language_pack: languagePack });
      }
    );

    app.get(
      "/ui/surfaces/:code",
      {
        config: {
          rateLimit: { max: 60, timeWindow: "1 minute" },
          cors: { origin: app.PUBLIC_ORIGINS, credentials: false }
        },
        schema: {
          params: {
            type: "object",
            required: ["code"],
            properties: { code: { type: "string", minLength: 2, maxLength: 64 } }
          },
          querystring: {
            type: "object",
            additionalProperties: false,
            properties: {
              tenant_id: { type: "string", minLength: 36, maxLength: 36 },
              tenant_code: { type: "string", maxLength: 64 }
            }
          }
        }
      },
      async (req, reply) => {
        const code = normalizeText(req.params.code);
        const tenantId = await resolveTenantId(app, {
          tenantId: normalizeText(req.query?.tenant_id),
          tenantCode: normalizeText(req.query?.tenant_code),
        });

        const surface = await fetchSurface(app, { code, tenantId, publicOnly: true });
        if (!surface) {
          return reply.code(404).send({ ok: false, error: "SURFACE_NOT_FOUND" });
        }

        return sendSurface(req, reply, surface, "public, max-age=60");
      }
    );
    return;
  }

  app.get("/user/dashboard/summary", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const summary = await buildDashboardSummary(app, s.session.tenant_id);
    return reply.send(summary);
  });

  app.get("/ui/language-pack", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const languagePack = await loadUiLanguagePack(app, s.session.tenant_id);
    return reply
      .header("Cache-Control", "private, max-age=0, must-revalidate")
      .send({ ok: true, language_pack: languagePack });
  });

  app.get("/user/dashboard/modules", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const activeModules = await buildActiveModules(app, s.session.tenant_id);
    return reply.send({ ok: true, active_modules: activeModules });
  });

  app.get("/user/dashboard/command-center", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const payload = await buildCommandCenterPayload(
      app,
      s.session.tenant_id,
      s.session.identity_id
    );
    return reply.send(payload);
  });

  app.post(
    "/user/tasks/:id/delegate",
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
          required: ["assigned_agent_id"],
          properties: {
            assigned_agent_id: { type: "string", minLength: 36, maxLength: 36 }
          }
        }
      }
    },
    async (req, reply) => {
      const s = await app.requireSession(req, { realm: "EIP" });
      if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

      const c = await app.requireCsrf(req);
      if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

      const result = await delegateCommandCenterTask(app, {
        tenantId: s.session.tenant_id,
        identityId: s.session.identity_id,
        taskId: normalizeText(req.params.id),
        assignedAgentId: normalizeText(req.body?.assigned_agent_id)
      });
      if (!result.ok) {
        return reply.code(result.status || 500).send(result);
      }
      return reply.send(result);
    }
  );

  app.post(
    "/user/tasks/:id/schedule",
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
            due_at: { anyOf: [{ type: "string", maxLength: 80 }, { type: "null" }] },
            planned_start_at: { anyOf: [{ type: "string", maxLength: 80 }, { type: "null" }] },
            planned_end_at: { anyOf: [{ type: "string", maxLength: 80 }, { type: "null" }] },
            reminder_at: { anyOf: [{ type: "string", maxLength: 80 }, { type: "null" }] },
            priority: { type: "string", maxLength: 40 },
            status: { type: "string", maxLength: 40 }
          }
        }
      }
    },
    async (req, reply) => {
      const s = await app.requireSession(req, { realm: "EIP" });
      if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

      const c = await app.requireCsrf(req);
      if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

      const result = await scheduleCommandCenterTask(app, {
        tenantId: s.session.tenant_id,
        identityId: s.session.identity_id,
        taskId: normalizeText(req.params.id),
        schedule: req.body || {}
      });
      if (!result.ok) {
        return reply.code(result.status || 500).send(result);
      }
      return reply.send(result);
    }
  );

  // Authenticated surfaces
  app.get(
    "/ui/surfaces/:code",
    {
      schema: {
        params: {
          type: "object",
          required: ["code"],
          properties: { code: { type: "string", minLength: 2, maxLength: 64 } }
        }
      }
    },
    async (req, reply) => {
      const s = await app.requireSession(req, { realm: "EIP" });
      if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

      const code = normalizeText(req.params.code);
      const accessCtx = await resolveEipSurfaceAccess(app, s.session);
      if (!isAuthenticatedSurfaceAllowed(code, accessCtx)) {
        return reply.code(403).send({
          ok: false,
          error: "SURFACE_FORBIDDEN",
          allowed_surfaces: accessCtx.allowed_surfaces,
          default_surface: accessCtx.default_surface,
          surface_classification: accessCtx.surface_classification,
        });
      }

      const surface = await fetchSurface(app, {
        code,
        tenantId: s.session.tenant_id,
        publicOnly: false,
      });

      if (!surface) {
        return reply.code(404).send({ ok: false, error: "SURFACE_NOT_FOUND" });
      }

      return sendSurface(req, reply, surface, "private, max-age=0, must-revalidate");
    }
  );
}
