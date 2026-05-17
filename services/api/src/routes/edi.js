// services/api/src/routes/edi.js

function hasScope(scopes, code) {
  if (!scopes || typeof scopes !== "object") return false;
  if (scopes[code] === true) return true;
  const parts = code.split(".");
  let cur = scopes;
  for (const part of parts) {
    if (!cur || typeof cur !== "object") return false;
    cur = cur[part];
  }
  return cur === true;
}

export default async function ediRoutes(app) {
  app.get("/whoami", async (req, reply) => {
    const i = await app.requireIntegration(req);
    if (!i.ok) return reply.code(i.status).send({ ok: false, error: i.error });

    const scopes = req.integration?.scopes ?? {};
    if (!hasScope(scopes, "edi.whoami.read")) {
      return reply.code(403).send({ ok: false, error: "FORBIDDEN" });
    }

    app.log.info({
      event: "edi_whoami",
      tenantId: req.integration.tenant_id,
      apiKeyId: req.integration.api_key_id,
      ip: req.ip
    });

    return reply.send({
      ok: true,
      tenant_id: req.integration.tenant_id,
      api_key_id: req.integration.api_key_id,
      scopes
    });
  });
}
