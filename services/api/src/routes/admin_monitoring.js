// services/api/src/routes/admin_monitoring.js
import { hasPermission } from "../auth/perm.js";
import { resolveEipSurfaceAccess } from "../lib/surfaceAccess.js";

const RANGE_PRESETS = {
  "24h": { hours: 24, bucketHours: 3, label: "24h" },
  "7d": { hours: 24 * 7, bucketHours: 24, label: "7d" },
  "30d": { hours: 24 * 30, bucketHours: 72, label: "30d" },
};

const RECENT_EVENT_PAGE_SIZE_DEFAULT = 25;
const RECENT_EVENT_PAGE_SIZE_MAX = 100;
const SECURITY_EVENT_OUTCOMES = new Set(["success", "failure", "denied", "rejected", "blocked", "error", "observed"]);
const SECURITY_EVENT_SEVERITIES = new Set(["debug", "info", "warning", "error", "critical"]);

function normalizeQueryText(value, maxLength = 120) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.slice(0, maxLength);
}

function normalizeSetValue(value, allowedValues) {
  const text = normalizeQueryText(value, 40).toLowerCase();
  return allowedValues.has(text) ? text : "";
}

function parsePositiveInt(value, { fallback, min = 1, max = Number.MAX_SAFE_INTEGER }) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function appendQueryParam(params, value) {
  params.push(value);
  return `$${params.length}`;
}

function normalizeRecentEventFilters(query = {}) {
  return {
    event_type: normalizeQueryText(query.event_type),
    tenant: normalizeQueryText(query.tenant),
    outcome: normalizeSetValue(query.outcome, SECURITY_EVENT_OUTCOMES),
    severity: normalizeSetValue(query.severity, SECURITY_EVENT_SEVERITIES)
  };
}

function buildRecentEventFilterSql(filters, params) {
  const clauses = [];

  if (filters.event_type) {
    clauses.push(`se.event_type = ${appendQueryParam(params, filters.event_type)}`);
  }

  if (filters.tenant) {
    const exact = appendQueryParam(params, filters.tenant);
    const pattern = appendQueryParam(params, `%${filters.tenant}%`);
    clauses.push(`(se.tenant_id::text = ${exact} OR t.code ILIKE ${pattern} OR t.name ILIKE ${pattern})`);
  }

  if (filters.outcome) {
    clauses.push(`se.outcome = ${appendQueryParam(params, filters.outcome)}`);
  }

  if (filters.severity) {
    clauses.push(`se.severity = ${appendQueryParam(params, filters.severity)}`);
  }

  if (clauses.length === 0) return "";
  return `AND ${clauses.join("\n        AND ")}`;
}

function formatCompact(value) {
  const n = Number(value || 0);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

function formatPercent(value, digits = 2) {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(digits)}%`;
}

function formatLatency(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return "0 ms";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}

function formatDelta(current, previous, suffix = "%") {
  const cur = Number(current || 0);
  const prev = Number(previous || 0);
  if (prev <= 0 && cur <= 0) return `0${suffix}`;
  if (prev <= 0) return `up ${cur}${suffix}`;
  const diff = ((cur - prev) / prev) * 100;
  const direction = diff >= 0 ? "up" : "down";
  return `${direction} ${Math.abs(diff).toFixed(0)}${suffix}`;
}

function formatTimeLabel(date, bucketHours) {
  const d = new Date(date);
  if (bucketHours >= 24) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return d.toISOString().slice(11, 16);
}

function timeAgo(from, to = new Date()) {
  const delta = Math.max(0, to - from);
  if (delta < 60_000) return "just now";
  if (delta < 3_600_000) return `${Math.round(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.round(delta / 3_600_000)}h ago`;
  return `${Math.round(delta / 86_400_000)}d ago`;
}

async function securityEventTableExists(app) {
  const r = await app.db.query("SELECT to_regclass('eip_core.security_event') AS name");
  return Boolean(r.rows[0]?.name);
}

async function canReadSecurityOps(app, session) {
  const checks = await Promise.all([
    hasPermission(app, session.tenant_id, session.identity_id, "security.ops.read"),
    hasPermission(app, session.tenant_id, session.identity_id, "privacy.audit.view"),
    hasPermission(app, session.tenant_id, session.identity_id, "tenant.connection.log")
  ]);
  return checks.some(Boolean);
}

async function buildSecurityScope(app, session) {
  const access = await resolveEipSurfaceAccess(app, session);
  if (access.is_owner_admin_session === true) {
    return { where: "", params: [], ownerAdmin: true };
  }
  return {
    where: `
      AND (
        se.tenant_id = $2::uuid
        OR se.actor_tenant_id = $2::uuid
        OR se.target_tenant_id = $2::uuid
      )
    `,
    params: [session.tenant_id],
    ownerAdmin: false
  };
}

export default async function adminMonitoringRoutes(app) {
  app.get("/admin/security/ops", async (req, reply) => {
    const session = await app.requireSession(req, { realm: "EIP" });
    if (!session.ok) return reply.code(session.status).send({ ok: false, error: session.error });

    const allowed = await canReadSecurityOps(app, session.session);
    if (!allowed) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });

    const windowKey = String(req.query?.window || req.query?.range || "24h").toLowerCase();
    const preset = RANGE_PRESETS[windowKey] || RANGE_PRESETS["24h"];
    const requestedPage = parsePositiveInt(req.query?.page, { fallback: 1, min: 1 });
    const pageSize = parsePositiveInt(req.query?.page_size, {
      fallback: RECENT_EVENT_PAGE_SIZE_DEFAULT,
      min: 1,
      max: RECENT_EVENT_PAGE_SIZE_MAX
    });
    const recentEventFilters = normalizeRecentEventFilters(req.query || {});

    const exists = await securityEventTableExists(app);
    if (!exists) {
      return reply.send({
        ok: true,
        generatedAt: new Date().toISOString(),
        warning: "SECURITY_EVENT_TABLE_MISSING",
        summary: {},
        connection_health: [],
        top_failures: [],
        recent_events: [],
        recent_events_pagination: {
          page: requestedPage,
          page_size: pageSize,
          total: 0,
          total_pages: 0
        },
        recent_event_filters: recentEventFilters,
        recent_event_filter_options: {
          event_types: [],
          tenants: []
        }
      });
    }

    const now = new Date();
    const from = new Date(now.getTime() - preset.hours * 60 * 60 * 1000);
    const scope = await buildSecurityScope(app, session.session);
    const params = [from, ...scope.params];

    const summaryRes = await app.db.query(
      `
      SELECT
        count(*)::int AS total_events,
        count(*) FILTER (WHERE outcome IN ('failure','denied','rejected','blocked','error'))::int AS total_failures,
        count(*) FILTER (WHERE severity IN ('error','critical'))::int AS high_severity,
        count(*) FILTER (WHERE category = 'auth' AND outcome IN ('failure','denied','rejected','blocked','error'))::int AS auth_failures,
        count(*) FILTER (WHERE category IN ('gateway','public_commerce') AND outcome IN ('failure','denied','rejected','blocked','error'))::int AS gateway_failures,
        count(*) FILTER (WHERE category = 'upload' AND outcome IN ('failure','denied','rejected','blocked','error'))::int AS upload_rejections,
        count(*) FILTER (WHERE event_type IN ('connection.secret_rotated','connection.secret_revoked'))::int AS secret_changes,
        max(occurred_at) AS last_event_at
      FROM eip_core.security_event se
      WHERE se.occurred_at >= $1
      ${scope.where}
      `,
      params
    );

    const topFailuresRes = await app.db.query(
      `
      SELECT
        se.event_type,
        se.category,
        se.reason,
        se.severity,
        count(*)::int AS count,
        max(se.occurred_at) AS last_seen_at
      FROM eip_core.security_event se
      WHERE se.occurred_at >= $1
        AND se.outcome IN ('failure','denied','rejected','blocked','error')
      ${scope.where}
      GROUP BY se.event_type, se.category, se.reason, se.severity
      ORDER BY count DESC, last_seen_at DESC
      LIMIT 12
      `,
      params
    );

    const connectionHealthRes = await app.db.query(
      `
      SELECT
        se.tenant_id,
        t.code AS tenant_code,
        t.name AS tenant_name,
        se.connection_code,
        se.suffix,
        count(*)::int AS total_events,
        count(*) FILTER (WHERE se.outcome = 'success')::int AS success_events,
        count(*) FILTER (WHERE se.outcome IN ('failure','denied','rejected','blocked','error'))::int AS failure_events,
        count(*) FILTER (WHERE se.event_type = 'gateway.origin_rejected')::int AS origin_rejections,
        count(*) FILTER (WHERE se.event_type = 'gateway.idempotency_rejected')::int AS idempotency_rejections,
        count(*) FILTER (WHERE se.event_type = 'gateway.verification_failed')::int AS verification_failures,
        max(se.occurred_at) AS last_seen_at
      FROM eip_core.security_event se
      LEFT JOIN eip_core.tenant t ON t.id = se.tenant_id
      WHERE se.occurred_at >= $1
        AND se.category IN ('gateway','public_commerce','connection')
        AND (se.connection_code IS NOT NULL OR se.suffix IS NOT NULL)
      ${scope.where}
      GROUP BY se.tenant_id, t.code, t.name, se.connection_code, se.suffix
      ORDER BY failure_events DESC, total_events DESC, last_seen_at DESC
      LIMIT 25
      `,
      params
    );

    const eventTypeOptionsRes = await app.db.query(
      `
      SELECT
        se.event_type,
        count(*)::int AS count
      FROM eip_core.security_event se
      WHERE se.occurred_at >= $1
        AND se.event_type IS NOT NULL
      ${scope.where}
      GROUP BY se.event_type
      ORDER BY count DESC, se.event_type
      LIMIT 200
      `,
      params
    );

    const tenantOptionsRes = await app.db.query(
      `
      SELECT
        se.tenant_id,
        t.code AS tenant_code,
        t.name AS tenant_name,
        count(*)::int AS count
      FROM eip_core.security_event se
      LEFT JOIN eip_core.tenant t ON t.id = se.tenant_id
      WHERE se.occurred_at >= $1
        AND se.tenant_id IS NOT NULL
      ${scope.where}
      GROUP BY se.tenant_id, t.code, t.name
      ORDER BY count DESC, t.code, t.name, se.tenant_id
      LIMIT 200
      `,
      params
    );

    const recentEventParams = [from, ...scope.params];
    const recentEventFilterSql = buildRecentEventFilterSql(recentEventFilters, recentEventParams);
    const recentEventsCountRes = await app.db.query(
      `
      SELECT count(*)::int AS total
      FROM eip_core.security_event se
      LEFT JOIN eip_core.tenant t ON t.id = se.tenant_id
      WHERE se.occurred_at >= $1
      ${scope.where}
      ${recentEventFilterSql}
      `,
      recentEventParams
    );
    const recentEventsTotal = Number(recentEventsCountRes.rows[0]?.total || 0);
    const recentEventsTotalPages = recentEventsTotal > 0 ? Math.ceil(recentEventsTotal / pageSize) : 0;
    const page = recentEventsTotalPages > 0 ? Math.min(requestedPage, recentEventsTotalPages) : 1;
    const offset = (page - 1) * pageSize;
    const limitPlaceholder = appendQueryParam(recentEventParams, pageSize);
    const offsetPlaceholder = appendQueryParam(recentEventParams, offset);
    const recentEventsRes = await app.db.query(
      `
      SELECT
        se.id,
        se.occurred_at,
        se.event_type,
        se.category,
        se.severity,
        se.outcome,
        se.reason,
        se.tenant_id,
        t.code AS tenant_code,
        se.actor_tenant_id,
        se.actor_identity_id,
        se.target_tenant_id,
        se.target_identity_id,
        se.connection_code,
        se.suffix,
        se.event_id,
        se.ip,
        se.source,
        se.metadata
      FROM eip_core.security_event se
      LEFT JOIN eip_core.tenant t ON t.id = se.tenant_id
      WHERE se.occurred_at >= $1
      ${scope.where}
      ${recentEventFilterSql}
      ORDER BY se.occurred_at DESC
      LIMIT ${limitPlaceholder}
      OFFSET ${offsetPlaceholder}
      `,
      recentEventParams
    );

    const summary = summaryRes.rows[0] || {};
    return reply.send({
      ok: true,
      generatedAt: now.toISOString(),
      range: { label: preset.label, from: from.toISOString(), to: now.toISOString() },
      scope: { owner_admin: scope.ownerAdmin },
      summary,
      connection_health: connectionHealthRes.rows || [],
      top_failures: topFailuresRes.rows || [],
      recent_events: recentEventsRes.rows || [],
      recent_events_pagination: {
        page,
        page_size: pageSize,
        total: recentEventsTotal,
        total_pages: recentEventsTotalPages
      },
      recent_event_filters: recentEventFilters,
      recent_event_filter_options: {
        event_types: (eventTypeOptionsRes.rows || []).map((row) => ({
          value: row.event_type,
          label: row.event_type,
          count: row.count || 0
        })),
        tenants: (tenantOptionsRes.rows || []).map((row) => ({
          value: row.tenant_id,
          label: row.tenant_code || row.tenant_name || row.tenant_id,
          code: row.tenant_code || null,
          name: row.tenant_name || null,
          count: row.count || 0
        }))
      },
      alert_thresholds: {
        auth_failures_15m: 10,
        gateway_verification_failures_15m: 10,
        origin_rejections_15m: 10,
        upload_rejections_15m: 5,
        critical_events: 1
      }
    });
  });

  app.get("/admin/monitoring", async (req, reply) => {
    const session = await app.requireSession(req, { realm: "EIP" });
    if (!session.ok) return reply.code(session.status).send({ ok: false, error: session.error });

    const allowed = await hasPermission(app, session.session.tenant_id, session.session.identity_id, "tenant.onboarding.read");
    if (!allowed) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });

    const windowKey = String(req.query?.window || req.query?.range || "24h").toLowerCase();
    const preset = RANGE_PRESETS[windowKey] || RANGE_PRESETS["24h"];
    const windowHours = preset.hours;
    const bucketHours = preset.bucketHours;
    const bucketSeconds = bucketHours * 60 * 60;

    const now = new Date();
    const from = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
    const prevFrom = new Date(now.getTime() - windowHours * 2 * 60 * 60 * 1000);

    const countsRes = await app.db.query(
      `
      SELECT
        count(*) FILTER (WHERE started_at >= $1 AND started_at < $2)::int AS total_current,
        count(*) FILTER (WHERE started_at >= $3 AND started_at < $1)::int AS total_prev,
        count(*) FILTER (WHERE started_at >= $1 AND started_at < $2 AND status IN ('error','failed','blocked'))::int AS error_current,
        count(*) FILTER (WHERE started_at >= $3 AND started_at < $1 AND status IN ('error','failed','blocked'))::int AS error_prev
      FROM eip_core.process_instance
      `,
      [from, now, prevFrom]
    );

    const latencyCurrentRes = await app.db.query(
      `
      SELECT percentile_cont(0.95)
        WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (ended_at - started_at)) * 1000) AS p95
      FROM eip_core.process_instance
      WHERE ended_at IS NOT NULL
        AND started_at >= $1
        AND started_at < $2
      `,
      [from, now]
    );

    const latencyPrevRes = await app.db.query(
      `
      SELECT percentile_cont(0.95)
        WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (ended_at - started_at)) * 1000) AS p95
      FROM eip_core.process_instance
      WHERE ended_at IS NOT NULL
        AND started_at >= $1
        AND started_at < $2
      `,
      [prevFrom, from]
    );

    const activeFlowsRes = await app.db.query(
      `
      SELECT count(*)::int AS count
      FROM eip_core.process_instance
      WHERE ended_at IS NULL
      `
    );

    const prevActiveFlowsRes = await app.db.query(
      `
      SELECT count(*)::int AS count
      FROM eip_core.process_instance
      WHERE started_at <= $1
        AND (ended_at IS NULL OR ended_at > $1)
      `,
      [prevFrom]
    );

    const tenantRes = await app.db.query(
      `
      SELECT
        count(*) FILTER (WHERE is_active = true)::int AS active_tenants,
        count(*) FILTER (WHERE created_at >= now() - interval '7 days')::int AS new_tenants
      FROM eip_core.tenant
      `
    );

    const onboardingRes = await app.db.query(
      `
      SELECT count(*)::int AS pending
      FROM eip_core.tenant_request
      WHERE status_code IN ('SUBMITTED','UNDER_REVIEW','BOOTSTRAP_PENDING')
      `
    );

    const failedLoginRes = await app.db.query(
      `
      SELECT count(*)::int AS failed_logins
      FROM eip_auth.auth_failed_attempt
      WHERE attempted_at >= $1
      `,
      [from]
    );

    const otpRes = await app.db.query(
      `
      SELECT count(*)::int AS otp_requests
      FROM eip_auth.auth_otp_challenge
      WHERE created_at >= $1
      `,
      [from]
    );

    const sessionRes = await app.db.query(
      `
      SELECT count(*)::int AS active_sessions
      FROM eip_auth.auth_session
      WHERE is_revoked = false
        AND expires_at > now()
      `
    );

    const lastProcessRes = await app.db.query(
      `
      SELECT max(started_at) AS last_started
      FROM eip_core.process_instance
      `
    );

    const volumeRes = await app.db.query(
      `
      SELECT
        to_timestamp(floor(extract(epoch from pi.started_at) / $3) * $3) AS bucket_start,
        CASE
          WHEN lower(coalesce(pd.code,'')) ~ '^(edi|int|ingest|gateway)'
            OR lower(coalesce(pd.attrs->>'category','')) LIKE 'integration%'
            OR lower(coalesce(so.object_type,'')) LIKE '%integration%'
            THEN 'Integration'
          WHEN lower(coalesce(pd.code,'')) ~ '^(xform|transform|map)'
            OR lower(coalesce(pd.attrs->>'category','')) LIKE 'transform%'
            OR lower(coalesce(so.object_type,'')) LIKE '%transform%'
            THEN 'Transform'
          ELSE 'Route'
        END AS bucket_class,
        count(*)::int AS count
      FROM eip_core.process_instance pi
      LEFT JOIN eip_core.process_def pd ON pd.id = pi.process_def_id
      LEFT JOIN eip_core.service_object so ON so.id = pi.service_object_id
      WHERE pi.started_at >= $1
        AND pi.started_at < $2
      GROUP BY bucket_start, bucket_class
      ORDER BY bucket_start
      `,
      [from, now, bucketSeconds]
    );

    const logRes = await app.db.query(
      `
      SELECT
        pi.id,
        pi.status,
        pi.started_at,
        pi.ended_at,
        pi.attrs,
        so.id AS service_object_id,
        so.code AS service_object_code,
        so.object_type,
        so.attrs AS service_object_attrs,
        pd.code AS flow_code,
        t.code AS tenant_code
      FROM eip_core.process_instance pi
      JOIN eip_core.tenant t ON t.id = pi.tenant_id
      LEFT JOIN eip_core.process_def pd ON pd.id = pi.process_def_id
      LEFT JOIN eip_core.service_object so ON so.id = pi.service_object_id
      ORDER BY pi.started_at DESC
      LIMIT 6
      `
    );

    const counts = countsRes.rows[0] || {};
    const totalCurrent = counts.total_current || 0;
    const totalPrev = counts.total_prev || 0;
    const errorCurrent = counts.error_current || 0;
    const errorPrev = counts.error_prev || 0;
    const errorRate = totalCurrent ? (errorCurrent / totalCurrent) * 100 : 0;
    const errorRatePrev = totalPrev ? (errorPrev / totalPrev) * 100 : 0;

    const p95Current = Number(latencyCurrentRes.rows[0]?.p95 || 0);
    const p95Prev = Number(latencyPrevRes.rows[0]?.p95 || 0);

    const activeFlows = activeFlowsRes.rows[0]?.count || 0;
    const activeFlowsPrev = prevActiveFlowsRes.rows[0]?.count || 0;

    const tenants = tenantRes.rows[0] || {};
    const pendingOnboarding = onboardingRes.rows[0]?.pending || 0;
    const failedLogins = failedLoginRes.rows[0]?.failed_logins || 0;
    const otpRequests = otpRes.rows[0]?.otp_requests || 0;
    const activeSessions = sessionRes.rows[0]?.active_sessions || 0;

    const bucketMs = bucketSeconds * 1000;
    const nowEpoch = Math.floor(now.getTime() / 1000);
    const startEpoch = Math.floor((nowEpoch - windowHours * 3600) / bucketSeconds) * bucketSeconds;
    const startMs = startEpoch * 1000;
    const bucketCount = Math.ceil((nowEpoch - startEpoch) / bucketSeconds);
    const seriesMap = new Map();
    for (const row of volumeRes.rows) {
      const epoch = new Date(row.bucket_start).getTime();
      const key = `${epoch}:${row.bucket_class}`;
      seriesMap.set(key, row.count);
    }

    const labels = [];
    const integration = [];
    const transform = [];
    const route = [];
    for (let i = 0; i < bucketCount; i += 1) {
      const bucketStart = new Date(startMs + i * bucketMs);
      labels.push(formatTimeLabel(bucketStart, bucketHours));
      const epoch = bucketStart.getTime();
      integration.push(seriesMap.get(`${epoch}:Integration`) || 0);
      transform.push(seriesMap.get(`${epoch}:Transform`) || 0);
      route.push(seriesMap.get(`${epoch}:Route`) || 0);
    }

    const volumeTotal = integration.reduce(
      (sum, value, idx) => sum + Number(value || 0) + Number(transform[idx] || 0) + Number(route[idx] || 0),
      0
    );
    const lastProcessAt = lastProcessRes.rows[0]?.last_started
      ? new Date(lastProcessRes.rows[0].last_started).toISOString()
      : null;

    const buildDetailsFor = (row) => {
      const statusText = row?.status || "Processing";
      const latencyMs = row?.ended_at ? new Date(row.ended_at) - new Date(row.started_at) : null;
      const detailId = row?.service_object_code || row?.id || "#EIP-0000";
      return {
        title: "Transaction Details",
        id: detailId,
        status: statusText,
        tabs: ["Trace", "Logs", "Inspector"],
        panels: {
          Trace: [
            { label: "Flow Type", value: row?.flow_code || row?.object_type || "Process" },
            { label: "Flow Pattern", value: row?.object_type || "General" },
            { label: "Integration Client", value: row?.tenant_code || "Tenant" },
            { label: "Resource Topic", value: row?.attrs?.topic || row?.service_object_attrs?.topic || "/ingress" },
          ],
          Logs: [
            { label: "Last event", value: statusText },
            { label: "Started", value: row?.started_at ? new Date(row.started_at).toISOString() : "n/a" },
            { label: "Duration", value: latencyMs ? formatLatency(latencyMs) : "in progress" },
            { label: "Attempts", value: row?.attrs?.attempts || "1" },
          ],
          Inspector: [
            { label: "Instance", value: row?.id || "n/a" },
            { label: "Service Object", value: row?.service_object_id || "n/a" },
            { label: "Tenant", value: row?.tenant_code || "n/a" },
            { label: "Status", value: statusText },
          ],
        },
      };
    };

    const buildTraceFor = (row) =>
      ({
        title: "Transaction Trace",
        tabs: ["JSON", "Form", "Table", "XML"],
        payload: JSON.stringify(
          {
            instance_id: row?.id || null,
            flow_code: row?.flow_code || null,
            object_type: row?.object_type || null,
            tenant: row?.tenant_code || null,
            status: row?.status || "Processing",
            started_at: row?.started_at || null,
            ended_at: row?.ended_at || null,
          },
          null,
          2
        ),
      });

    const latest = logRes.rows[0];
    const lastSyncAt = latest?.started_at ? new Date(latest.started_at) : null;
    const latestDetails = buildDetailsFor(latest);
    const latestTrace = buildTraceFor(latest);

    const logItems = logRes.rows.slice(0, 5).map((row) => {
      const rowLatency = row.ended_at ? new Date(row.ended_at) - new Date(row.started_at) : null;
      const startedLabel = row.started_at
        ? new Date(row.started_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "";
      return {
        id: String(row.service_object_code || row.id).slice(0, 8),
        flow: row.flow_code || "Flow",
        pattern: row.object_type || "Process",
        state: row.status || "Processing",
        latency: rowLatency ? formatLatency(rowLatency) : "in progress",
        started: startedLabel,
        tenant: row.tenant_code || "-",
        details: buildDetailsFor(row),
        trace: buildTraceFor(row),
      };
    });

    const logRows = logItems.map((item) => [
      item.id,
      item.flow,
      item.pattern,
      item.state,
      item.latency,
      item.started,
      item.tenant,
    ]);

    const errorTrend = formatDelta(errorRate, errorRatePrev, "%");

    return reply.send({
      ok: true,
      generatedAt: now.toISOString(),
      range: { from: from.toISOString(), to: now.toISOString() },
      kpis: [
        {
          label: "Total Transactions",
          value: formatCompact(totalCurrent),
          delta: formatDelta(totalCurrent, totalPrev, "%"),
          tone: "emerald",
        },
        {
          label: "Error Rate",
          value: formatPercent(errorRate, 2),
          delta: errorTrend,
          tone: "rose",
        },
        {
          label: "P95 Latency",
          value: formatLatency(p95Current),
          delta: formatDelta(p95Current, p95Prev, "%"),
          tone: "indigo",
        },
        {
          label: "Active Flows",
          value: formatCompact(activeFlows),
          delta: formatDelta(activeFlows, activeFlowsPrev, "%"),
          tone: "cyan",
        },
      ],
      volume: {
        title: "EIP Transaction Volume",
        range: preset.label,
        labels,
        series: [
          { name: "Integration", color: "#67b7c5", data: integration },
          { name: "Transform", color: "#8b8df2", data: transform },
          { name: "Route", color: "#a8d7c0", data: route },
        ],
        meta: {
          total: volumeTotal,
          lastDataAt: lastProcessAt,
        },
      },
      log: {
        title: "EIP Transaction Log",
        columns: ["ID", "Flow", "Pattern", "State", "Latency", "Started", "Tenant"],
        items: logItems,
        rows: logRows,
      },
      details: latestDetails,
      trace: latestTrace,
      notes: {
        lastSync: lastSyncAt ? `Last sync ${timeAgo(lastSyncAt, now)}` : "Last sync unavailable",
        alert: errorRate > 0 ? `Error rate ${errorTrend} in last 24h` : "No elevated errors detected",
        activeTenants: tenants.active_tenants || 0,
        newTenants: tenants.new_tenants || 0,
        pendingOnboarding,
        failedLogins,
        otpRequests,
        activeSessions,
      },
    });
  });
}
