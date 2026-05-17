import { buildEnvelope } from "./envelope.js";
import { insertGatewayAudit } from "./audit.js";
import { buildRequestHash, ensureIdempotency, finalizeIdempotency } from "./idempotency.js";
import { applyFieldMap, resolveFieldMap } from "./fieldMap.js";

function normalizeText(value) {
  return String(value || "").trim();
}

async function handleEdiIngress(app, opts) {
  const {
    tenantId,
    clientId,
    messageId,
    correlationId,
    rawBody,
    body,
    req
  } = opts;

  const scope = "edi.gateway.ingress";
  const requestHash = buildRequestHash(rawBody);

  const idem = await ensureIdempotency(app.db, {
    tenantId,
    scope,
    key: messageId,
    requestHash
  });

  if (!idem.ok) {
    return { ok: false, status: 409, error: idem.error };
  }
  if (idem.replay) {
    return {
      ok: true,
      replay: true,
      response: idem.response || { ok: true, accepted: true, message_id: messageId }
    };
  }

  const mapping = await resolveFieldMap(app.db, tenantId, {
    kind: "edi_ingress",
    messageType: normalizeText(body?.type)
  });

  const mappedPayload = mapping
    ? applyFieldMap(body?.payload || {}, mapping.map, {
        defaults: mapping.defaults,
        dropEmpty: mapping.dropEmpty
      })
    : body?.payload || {};

  const envelope = buildEnvelope({
    tenantId,
    realm: "INTEGRATION",
    channel: "SIGNED_REQUEST",
    actor: {
      type: "integration_client",
      client_id: clientId
    },
    idempotencyKey: messageId,
    message: {
      type: normalizeText(body?.type),
      version: body?.version || 1,
      payload: mappedPayload
    },
    meta: {
      received_at: new Date().toISOString(),
      source_ip: req.ip,
      correlation_id: correlationId || null
    }
  });

  const response = {
    ok: true,
    accepted: true,
    message_id: messageId,
    correlation_id: correlationId || null,
    result: "recorded"
  };

  await insertGatewayAudit(app.db, {
    tenantId,
    title: "gateway.edi.ingress",
    payload: { message: envelope.message },
    attrs: {
      realm: envelope.realm,
      channel: envelope.channel,
      route: req.routerPath || req.url,
      method: req.method,
      actor_type: envelope.actor.type,
      actor_ref: clientId,
      message_id: messageId,
      correlation_id: correlationId || null,
      mapping_id: mapping?.id || null,
      request_meta: {
        ip: req.ip,
        user_agent: req.headers["user-agent"] || null
      }
    }
  });

  await finalizeIdempotency(app.db, {
    tenantId,
    scope,
    key: messageId,
    response
  });

  return response;
}

export { handleEdiIngress };
