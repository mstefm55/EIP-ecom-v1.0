function positiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function resolveQuota({ profile, config, category }) {
  const profileQuota = profile?.inbound?.quota || profile?.inbound?.quotas || {};
  const prefix = category === "public_commerce" ? "PUBLIC_COMMERCE" : "PUBLIC_GATEWAY";
  return {
    max: positiveInt(profileQuota.max || profileQuota.max_events || config?.[`${prefix}_QUOTA_MAX`], category === "public_commerce" ? 5000 : 3000),
    windowSec: positiveInt(profileQuota.window_sec || config?.[`${prefix}_QUOTA_WINDOW_SEC`], 3600)
  };
}

async function countRecentSecurityEvents(db, { tenantId, category, connectionCode, suffix, windowSec }) {
  const r = await db.query(
    `
    SELECT count(*)::int AS event_count
    FROM eip_core.security_event
    WHERE tenant_id = $1::uuid
      AND category = $2
      AND occurred_at > now() - ($3 * interval '1 second')
      AND ($4::text IS NULL OR connection_code = $4)
      AND ($5::text IS NULL OR suffix = $5)
    `,
    [
      tenantId,
      category,
      windowSec,
      normalizeText(connectionCode) || null,
      normalizeText(suffix) || null
    ]
  );
  return r.rows[0]?.event_count || 0;
}

async function enforceConnectionQuota(app, {
  tenantId,
  category,
  profile,
  connectionCode,
  suffix
}) {
  if (!tenantId || !app?.db?.query) return { ok: true };
  const quota = resolveQuota({ profile, config: app.config, category });
  if (!quota.max || quota.max <= 0) return { ok: true };

  let eventCount = 0;
  try {
    eventCount = await countRecentSecurityEvents(app.db, {
      tenantId,
      category,
      connectionCode,
      suffix,
      windowSec: quota.windowSec
    });
  } catch (error) {
    app.log?.warn?.({
      event: "security_event_quota_check_failed",
      tenantId,
      category,
      connectionCode,
      suffix,
      error: error?.message || String(error)
    });
    return { ok: true, degraded: true, max: quota.max, window_sec: quota.windowSec, observed: 0 };
  }

  if (eventCount >= quota.max) {
    return {
      ok: false,
      error: "QUOTA_EXCEEDED",
      max: quota.max,
      window_sec: quota.windowSec,
      observed: eventCount,
      retry_after_sec: quota.windowSec
    };
  }
  return { ok: true, max: quota.max, window_sec: quota.windowSec, observed: eventCount };
}

export { enforceConnectionQuota, resolveQuota };
