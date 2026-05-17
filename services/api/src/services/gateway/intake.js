import { buildEnvelope } from "./envelope.js";
import { insertGatewayAudit } from "./audit.js";
import { applyFieldMap, resolveFieldMap } from "./fieldMap.js";

function normalizeText(value) {
  return String(value || "").trim();
}

async function handlePublicIntake(app, opts) {
  const {
    tenantId,
    tenantCode,
    source,
    form,
    payload,
    correlationId,
    req
  } = opts;

  const mapping = await resolveFieldMap(app.db, tenantId, {
    kind: "public_intake",
    source,
    form
  });

  const mappedPayload = mapping
    ? applyFieldMap(payload, mapping.map, {
        defaults: mapping.defaults,
        dropEmpty: mapping.dropEmpty
      })
    : payload;

  const envelope = buildEnvelope({
    tenantId,
    realm: "PUBLIC",
    channel: "PUBLIC_FORM",
    actor: { type: "anonymous" },
    idempotencyKey: null,
    message: {
      type: "PUBLIC_INTAKE",
      version: 1,
      payload: mappedPayload
    },
    meta: {
      received_at: new Date().toISOString(),
      source_ip: req.ip,
      user_agent: req.headers["user-agent"] || null,
      correlation_id: correlationId || null
    }
  });

  const auditId = await insertGatewayAudit(app.db, {
    tenantId,
    title: `gateway.public.${normalizeText(source || "intake")}`,
    payload: {
      tenant_code: tenantCode,
      message: envelope.message
    },
    attrs: {
      realm: envelope.realm,
      channel: envelope.channel,
      route: req.routerPath || req.url,
      method: req.method,
      actor_type: envelope.actor.type,
      correlation_id: correlationId || null,
      mapping_id: mapping?.id || null,
      request_meta: {
        ip: req.ip,
        user_agent: req.headers["user-agent"] || null
      }
    }
  });

  return {
    ok: true,
    accepted: true,
    correlation_id: correlationId || null,
    intake_ref: auditId
  };
}

export { handlePublicIntake };
