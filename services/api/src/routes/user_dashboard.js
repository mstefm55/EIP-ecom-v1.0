// services/api/src/routes/user_dashboard.js

const OPEN_TASK_STATUSES = ["open", "assigned", "in_progress", "blocked", "pending"];

function normalizeText(value) {
  return String(value || "").trim();
}

function uniqueStrings(values) {
  return [...new Set((values || []).map(normalizeText).filter(Boolean))];
}

function moduleFromSurface(row) {
  const attrs = row?.attrs && typeof row.attrs === "object" ? row.attrs : {};
  return normalizeText(attrs.module || attrs.surface_group || attrs.area || row.code);
}

export default async function userDashboardRoutes(app) {
  app.get("/user/dashboard/summary", async (req, reply) => {
    const sessionResult = await app.requireSession(req, { realm: "EIP" });
    if (!sessionResult.ok) {
      return reply.code(sessionResult.status).send({ ok: false, error: sessionResult.error });
    }

    const { tenant_id: tenantId } = sessionResult.session;

    const [moduleSettingsRes, surfacesRes, openTasksRes, reportsRes, recentTasksRes, recentReportsRes] = await Promise.all([
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
      ),
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

    const modulesFromSettings = moduleSettingsRes.rows.map((row) => row.module);
    const modulesFromSurfaces = surfacesRes.rows.map(moduleFromSurface);
    const activeModules = uniqueStrings([...modulesFromSettings, ...modulesFromSurfaces]);

    return reply.send({
      ok: true,
      stats: {
        active_modules: activeModules.length,
        open_tasks: Number(openTasksRes.rows?.[0]?.total || 0),
        recent_reports: Number(reportsRes.rows?.[0]?.total || 0)
      },
      active_modules: activeModules.sort((a, b) => a.localeCompare(b)),
      open_task_statuses: OPEN_TASK_STATUSES,
      recent_tasks: recentTasksRes.rows || [],
      recent_reports: recentReportsRes.rows || []
    });
  });
}
