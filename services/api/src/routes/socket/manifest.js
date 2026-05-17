// services/api/src/routes/socket/manifest.js

function getOrigin(req) {
  // Browser sends Origin; curl often doesn't unless you set it.
  return String(req.headers.origin || "").trim();
}

async function fetchPublishedManifest(app, { tenantId, code }) {
  const r = await app.db.query(
    `
    SELECT id, tenant_id, code, version, published_at, manifest, attrs
    FROM eip_commerce.socket_manifest
    WHERE tenant_id = $1::uuid
      AND code = $2::text
      AND is_published = true
    ORDER BY version DESC
    LIMIT 1
    `,
    [tenantId, code]
  );

  return r.rows[0] || null;
}

async function isOriginAllowed(app, { tenantId, channelCode, origin }) {
  if (!origin) return false;

  const r = await app.db.query(
    `
    SELECT 1
    FROM eip_commerce.socket_channel sc
    JOIN eip_commerce.socket_origin_allowlist so
      ON so.channel_id = sc.id
    WHERE sc.tenant_id = $1::uuid
      AND sc.code = $2::text
      AND sc.is_active = true
      AND so.is_active = true
      AND so.origin = $3::text
    LIMIT 1
    `,
    [tenantId, channelCode, origin]
  );

  return r.rowCount > 0;
}

export default async function socketManifestRoutes(app) {
  /**
   * INTERNAL (EIP only): used by licensed users/admin tooling
   * GET /api/eip/socket/manifest?code=WEB
   */
  app.get("/eip/socket/manifest", async (req, reply) => {
    const s = await app.requireSession(req, { realm: app.REALMS?.EIP || "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const tenantId = s.session.tenant_id;
    const code = String(req.query?.code || "WEB").trim();

    const row = await fetchPublishedManifest(app, { tenantId, code });
    if (!row) {
      return reply.code(404).send({
        ok: false,
        error: "SOCKET_MANIFEST_NOT_FOUND",
        tenantId,
        code,
      });
    }

    return reply.send({
      ok: true,
      id: row.id,
      tenantId: row.tenant_id,
      code: row.code,
      version: row.version,
      publishedAt: row.published_at,
      manifest: row.manifest ?? {},
      attrs: row.attrs ?? {},
    });
  });

  /**
   * PUBLIC (tenant website plug-and-play): no session
   * GET /api/public/socket/manifest?tenantId=<uuid>&code=WEB
   *
   * Security model:
   * - Only returns PUBLISHED manifests
   * - Enforces Origin allowlist (governed in DB)
   */
  app.get(
    "/public/socket/manifest",
    {
      config: {
        rateLimit: { max: 60, timeWindow: "1 minute" },
        cors: { origin: app.PUBLIC_ORIGINS, credentials: false }
      }
    },
    async (req, reply) => {
    const tenantId = String(req.query?.tenantId || "").trim();
    const code = String(req.query?.code || "WEB").trim();

    if (!tenantId) {
      return reply.code(400).send({ ok: false, error: "TENANT_REQUIRED" });
    }

    const origin = getOrigin(req);

    const allowed = await isOriginAllowed(app, {
      tenantId,
      channelCode: code,
      origin,
    });

    if (!allowed) {
      app.log.warn({ event: "socket_manifest_origin_denied", tenantId, code, origin, ip: req.ip });
      return reply.code(403).send({
        ok: false,
        error: "ORIGIN_NOT_ALLOWED",
      });
    }

    const row = await fetchPublishedManifest(app, { tenantId, code });
    if (!row) {
      app.log.warn({ event: "socket_manifest_not_found", tenantId, code, origin, ip: req.ip });
      return reply.code(404).send({
        ok: false,
        error: "SOCKET_MANIFEST_NOT_FOUND",
      });
    }

    return reply.send({
      ok: true,
      code: row.code,
      version: row.version,
      publishedAt: row.published_at,
      manifest: row.manifest ?? {},
      attrs: row.attrs ?? {},
    });
    }
  );
}
