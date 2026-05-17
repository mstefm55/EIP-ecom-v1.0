// services/api/src/routes/authz.js

export default async function authzRoutes(app) {
  // Internal EIP-only bootstrap (licensed user surfaces)
  app.get("/authz/bootstrap", async (req, reply) => {
    // Require session AND enforce realm=EIP
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) {
      return reply.code(s.status).send({ ok: false, error: s.error });
    }

    // If your app.requireCsrf is "reply-style" (sends reply itself), call it and stop if reply.sent
    // If your app.requireCsrf is "object-returning", adjust to match.
    // Based on your earlier working authz flow, you were enforcing CSRF even on GET.
    // Keep that policy: enforce CSRF here too.
    if (typeof app.requireCsrf === "function") {
      const c = await app.requireCsrf(req, reply);
      if (reply.sent) return; // reply-style guard already responded
      // If your requireCsrf returns an object instead (old style), handle it safely:
      if (c && c.ok === false) {
        return reply.code(c.status || 403).send({ ok: false, error: c.error });
      }
    }

    const { tenant_id: tenantId, identity_id: identityId } = s.session;

    const r = await app.db.query(
      "SELECT eip_authz.bootstrap($1::uuid, $2::uuid) AS payload",
      [tenantId, identityId]
    );

    return reply.send({ ok: true, payload: r.rows[0]?.payload ?? null });
  });
}
