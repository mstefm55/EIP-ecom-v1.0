import { extractProfiles, normalizeProfile } from "./connectionProfile.js";

function normalizeText(value) {
  return String(value || "").trim();
}

export function applyConnectionTestHealth(
  profiles,
  connectionCode,
  { ok, checkedAt = new Date().toISOString(), mode = "", error = "" } = {}
) {
  const code = normalizeText(connectionCode);
  let connection = null;
  const nextProfiles = (Array.isArray(profiles) ? profiles : []).map((item, index) => {
    const profile = normalizeProfile(item, item?.id || `conn-${index + 1}`);
    if (profile.identity?.connection_code !== code) return profile;
    const healthy = ok === true;
    const updated = {
      ...profile,
      routing: {
        ...profile.routing,
        health_status: healthy ? "healthy" : "unhealthy",
        provider_available: healthy && profile.identity?.is_enabled !== false,
        health_mode: normalizeText(mode || profile.identity?.environment || "production").toLowerCase(),
        health_checked_at: checkedAt,
        last_successful_test_at: healthy
          ? checkedAt
          : normalizeText(profile.routing?.last_successful_test_at),
        health_error: healthy ? "" : normalizeText(error || "OUTBOUND_TEST_FAILED")
      }
    };
    connection = updated;
    return updated;
  });

  if (!connection) {
    const failure = new Error("CONNECTION_NOT_FOUND");
    failure.code = "CONNECTION_NOT_FOUND";
    throw failure;
  }
  return { profiles: nextProfiles, connection };
}

export async function persistConnectionTestHealth(db, tenantId, connectionCode, result) {
  const client = typeof db.connect === "function" ? await db.connect() : db;
  const transactional = client !== db;
  try {
    if (transactional) await client.query("BEGIN");
    const tenantRes = await client.query(
      "SELECT attrs FROM eip_core.tenant WHERE id = $1::uuid FOR UPDATE",
      [tenantId]
    );
    if (tenantRes.rowCount === 0) {
      const failure = new Error("TENANT_NOT_FOUND");
      failure.code = "TENANT_NOT_FOUND";
      throw failure;
    }

    const update = applyConnectionTestHealth(
      extractProfiles(tenantRes.rows[0].attrs || {}),
      connectionCode,
      result
    );
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
      [tenantId, JSON.stringify(update.profiles)]
    );
    if (transactional) await client.query("COMMIT");
    return update.connection;
  } catch (error) {
    if (transactional) await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    if (transactional) client.release();
  }
}
