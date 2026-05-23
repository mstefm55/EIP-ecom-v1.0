import { isAuthenticatedSurfaceAllowed, resolveEipSurfaceAccess } from "../lib/surfaceAccess.js";

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

export default async function uiSurfaceRoutes(app, opts = {}) {
  const isPublic = opts.public === true;

  if (isPublic) {
    // Public surfaces (e.g., auth)
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
