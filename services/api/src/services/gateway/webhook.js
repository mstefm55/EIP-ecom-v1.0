import { buildEnvelope } from "./envelope.js";
import { insertGatewayAudit } from "./audit.js";
import { buildRequestHash, ensureIdempotency, finalizeIdempotency } from "./idempotency.js";
import { applyFieldMap, resolveFieldMap } from "./fieldMap.js";

function normalizeText(value) {
  return String(value || "").trim();
}

async function handleWebhook(app, opts) {
  const {
    tenantId,
    provider,
    messageId,
    correlationId,
    rawBody,
    body,
    req
  } = opts;

  const scope = `edi.gateway.webhook.${provider}`;
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
      response: idem.response || { ok: true }
    };
  }

  const mapping = await resolveFieldMap(app.db, tenantId, {
    kind: "webhook",
    provider
  });

  const mappedPayload = mapping
    ? applyFieldMap(body || {}, mapping.map, {
        defaults: mapping.defaults,
        dropEmpty: mapping.dropEmpty
      })
    : body || {};

  const envelope = buildEnvelope({
    tenantId,
    realm: "INTEGRATION",
    channel: "WEBHOOK_INBOUND",
    actor: { type: "provider", provider },
    idempotencyKey: messageId,
    message: {
      type: "WEBHOOK_EVENT",
      version: 1,
      payload: mappedPayload
    },
    meta: {
      received_at: new Date().toISOString(),
      source_ip: req.ip,
      correlation_id: correlationId || null
    }
  });

  const response = { ok: true };

  await insertGatewayAudit(app.db, {
    tenantId,
    title: `gateway.webhook.${normalizeText(provider)}`,
    payload: { message: envelope.message },
    attrs: {
      realm: envelope.realm,
      channel: envelope.channel,
      route: req.routerPath || req.url,
      method: req.method,
      actor_type: envelope.actor.type,
      actor_ref: provider,
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

export { handleWebhook };
