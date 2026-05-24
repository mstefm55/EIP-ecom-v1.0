// services/api/src/routes/edi_gateway.js
import { sha256Hex } from "../auth/crypto.js";
import { registerRawBody, parseJsonBody } from "../services/gateway/rawBody.js";
import { resolveTenantByCode, resolveProviderSecret } from "../services/gateway/tenantResolve.js";
import { handleEdiIngress } from "../services/gateway/ediIngress.js";
import { handleWebhook } from "../services/gateway/webhook.js";
import { handleEmailInbound } from "../services/gateway/emailInbound.js";
import { handleSocialInbound } from "../services/gateway/socialInbound.js";
import {
  hmacSha256Base64,
  verifySignature,
  resolveSignatureHeader,
  normalizeHeader,
  buildCanonicalWebhook
} from "../services/gateway/signature.js";

const BODY_LIMIT = 256 * 1024;
const TIME_SKEW_SEC = 5 * 60;

function normalizeText(value) {
  return String(value || "").trim();
}

function extractMessageId(req, rawBody) {
  const headerKeys = [
    "x-message-id",
    "x-event-id",
    "x-request-id",
    "x-provider-event-id"
  ];
  for (const key of headerKeys) {
    const v = normalizeHeader(req, key);
    if (v) return v;
  }
  return sha256Hex(rawBody || "");
}

function parseBodySafe(req, reply) {
  try {
    return parseJsonBody(req);
  } catch (err) {
    reply.code(400).send({ ok: false, error: "INVALID_JSON" });
    return null;
  }
}

function normalizeRawBody(req, body) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.rawBody === "string") return Buffer.from(req.rawBody, "utf8");
  if (typeof req.body === "string") return Buffer.from(req.body, "utf8");
  if (body && typeof body === "object") {
    return Buffer.from(JSON.stringify(body), "utf8");
  }
  return Buffer.from("", "utf8");
}

function verifyHmacSignature(req, provider, secret, rawBody) {
  const signature = resolveSignatureHeader(req, provider);
  if (!signature) return { ok: false, error: "SIGNATURE_MISSING" };

  const timestamp = normalizeHeader(req, "x-timestamp");
  if (timestamp) {
    const ts = Number(timestamp);
    if (!Number.isFinite(ts)) return { ok: false, error: "BAD_TIMESTAMP" };
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > TIME_SKEW_SEC) {
      return { ok: false, error: "TIMESTAMP_SKEW" };
    }
  }

  const canonical = buildCanonicalWebhook(rawBody, timestamp || null);
  const expected = hmacSha256Base64(secret, canonical);
  if (!verifySignature(signature, expected)) {
    return { ok: false, error: "SIGNATURE_INVALID" };
  }
  return { ok: true };
}

export default async function ediGatewayRoutes(app) {
  registerRawBody(app);

  app.post(
    "/gateway/ingress",
    {
      bodyLimit: BODY_LIMIT
    },
    async (req, reply) => {
      const auth = await app.requireIntegration(req);
      if (!auth.ok) {
        return reply.code(auth.status).send({ ok: false, error: auth.error });
      }

      const body = parseBodySafe(req, reply);
      if (!body) return;
      const rawBody = normalizeRawBody(req, body);
      if (!body || typeof body !== "object") {
        return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });
      }
      if (!body.type || typeof body.type !== "string" || !body.payload || typeof body.payload !== "object") {
        return reply.code(400).send({ ok: false, error: "BAD_REQUEST" });
      }

      const tenantId = req.integration.tenant_id;
      const clientId = normalizeText(req.headers["x-client-id"]) || req.integration.api_key_id;
      const messageId = normalizeText(req.headers["x-message-id"]);
      const correlationId = normalizeText(req.headers["x-correlation-id"]);

      if (!messageId) {
        return reply.code(400).send({ ok: false, error: "MESSAGE_ID_REQUIRED" });
      }

      const response = await handleEdiIngress(app, {
        tenantId,
        clientId,
        messageId,
        correlationId,
        rawBody,
        body,
        req
      });

      if (response.replay) {
        return reply.send(response.response || { ok: true, accepted: true });
      }
      if (response.status) {
        return reply.code(response.status).send({ ok: false, error: response.error });
      }
      return reply.send(response);
    }
  );

  app.post(
    "/gateway/webhook/:provider",
    { bodyLimit: BODY_LIMIT },
    async (req, reply) => {
      const body = parseBodySafe(req, reply);
      if (!body) return;

      const provider = normalizeText(req.params.provider);
      const tenantCode = normalizeText(req.headers["x-tenant-code"]);
      if (!tenantCode) {
        return reply.code(400).send({ ok: false, error: "TENANT_REQUIRED" });
      }

      const tenant = await resolveTenantByCode(app.db, tenantCode);
      if (!tenant) {
        return reply.code(400).send({ ok: false, error: "TENANT_NOT_FOUND" });
      }

      const keyId = normalizeText(req.headers["x-key-id"]);
      const secret = await resolveProviderSecret(app, app.db, tenant.id, provider, keyId);
      if (!secret) {
        return reply.code(401).send({ ok: false, error: "PROVIDER_SECRET_MISSING" });
      }

      if (!Buffer.isBuffer(req.rawBody)) {
        return reply.code(400).send({ ok: false, error: "RAW_BODY_REQUIRED" });
      }
      const rawBody = req.rawBody;
      const verified = verifyHmacSignature(req, provider, secret, rawBody);
      if (!verified.ok) {
        return reply.code(401).send({ ok: false, error: verified.error });
      }

      const messageId = extractMessageId(req, rawBody);
      const correlationId = normalizeText(req.headers["x-correlation-id"]);

      const response = await handleWebhook(app, {
        tenantId: tenant.id,
        provider,
        messageId,
        correlationId,
        rawBody,
        body,
        req
      });

      if (response.replay) return reply.send(response.response || { ok: true });
      if (response.status) return reply.code(response.status).send({ ok: false, error: response.error });
      return reply.send(response);
    }
  );

  app.post(
    "/gateway/email/inbound/:provider",
    { bodyLimit: BODY_LIMIT },
    async (req, reply) => {
      const body = parseBodySafe(req, reply);
      if (!body) return;

      const provider = normalizeText(req.params.provider);
      const tenantCode = normalizeText(req.headers["x-tenant-code"]);
      if (!tenantCode) {
        return reply.code(400).send({ ok: false, error: "TENANT_REQUIRED" });
      }

      const tenant = await resolveTenantByCode(app.db, tenantCode);
      if (!tenant) {
        return reply.code(400).send({ ok: false, error: "TENANT_NOT_FOUND" });
      }

      const keyId = normalizeText(req.headers["x-key-id"]);
      const secret = await resolveProviderSecret(app, app.db, tenant.id, provider, keyId);
      if (!secret) {
        return reply.code(401).send({ ok: false, error: "PROVIDER_SECRET_MISSING" });
      }

      if (!Buffer.isBuffer(req.rawBody)) {
        return reply.code(400).send({ ok: false, error: "RAW_BODY_REQUIRED" });
      }
      const rawBody = req.rawBody;
      const verified = verifyHmacSignature(req, provider, secret, rawBody);
      if (!verified.ok) {
        return reply.code(401).send({ ok: false, error: verified.error });
      }

      const messageId = extractMessageId(req, rawBody);
      const correlationId = normalizeText(req.headers["x-correlation-id"]);

      const response = await handleEmailInbound(app, {
        tenantId: tenant.id,
        provider,
        messageId,
        correlationId,
        rawBody,
        body,
        req
      });

      if (response.replay) return reply.send(response.response || { ok: true });
      if (response.status) return reply.code(response.status).send({ ok: false, error: response.error });
      return reply.send(response);
    }
  );

  app.post(
    "/gateway/social/:provider/webhook",
    { bodyLimit: BODY_LIMIT },
    async (req, reply) => {
      const body = parseBodySafe(req, reply);
      if (!body) return;

      const provider = normalizeText(req.params.provider);
      const tenantCode = normalizeText(req.headers["x-tenant-code"]);
      if (!tenantCode) {
        return reply.code(400).send({ ok: false, error: "TENANT_REQUIRED" });
      }

      const tenant = await resolveTenantByCode(app.db, tenantCode);
      if (!tenant) {
        return reply.code(400).send({ ok: false, error: "TENANT_NOT_FOUND" });
      }

      const keyId = normalizeText(req.headers["x-key-id"]);
      const secret = await resolveProviderSecret(app, app.db, tenant.id, provider, keyId);
      if (!secret) {
        return reply.code(401).send({ ok: false, error: "PROVIDER_SECRET_MISSING" });
      }

      if (!Buffer.isBuffer(req.rawBody)) {
        return reply.code(400).send({ ok: false, error: "RAW_BODY_REQUIRED" });
      }
      const rawBody = req.rawBody;
      const verified = verifyHmacSignature(req, provider, secret, rawBody);
      if (!verified.ok) {
        return reply.code(401).send({ ok: false, error: verified.error });
      }

      const messageId = extractMessageId(req, rawBody);
      const correlationId = normalizeText(req.headers["x-correlation-id"]);

      const response = await handleSocialInbound(app, {
        tenantId: tenant.id,
        provider,
        messageId,
        correlationId,
        rawBody,
        body,
        req
      });

      if (response.replay) return reply.send(response.response || { ok: true });
      if (response.status) return reply.code(response.status).send({ ok: false, error: response.error });
      return reply.send(response);
    }
  );
}
