import { sha256Hex, timingSafeEqual } from "../../auth/crypto.js";
import {
  buildRequestHash,
  ensureIdempotency,
  finalizeIdempotency
} from "../gateway/idempotency.js";
import { extractEventId } from "../gateway/verification.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function requireSessionBoundMemberCsrf(app, session, req, reply) {
  const csrfCookie = normalizeText(req.cookies?.member_csrf);
  const csrfHeader = normalizeText(req.headers["x-member-csrf"]);
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    reply.code(403).send({ ok: false, error: "MEMBER_CSRF_REQUIRED" });
    return false;
  }

  const expectedHash = sha256Hex(`${csrfCookie}:${app.config.CSRF_PEPPER}`);
  if (!session?.csrf_secret_hash || !timingSafeEqual(expectedHash, session.csrf_secret_hash)) {
    reply.code(403).send({ ok: false, error: "MEMBER_CSRF_INVALID" });
    return false;
  }
  return true;
}

async function beginPerfectFitWriteIdempotency(
  app,
  req,
  access,
  { action, hashPayload } = {}
) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const eventId = extractEventId(req, body, access.profile);
  if (!eventId) {
    return { ok: false, error: "IDEMPOTENCY_REQUIRED" };
  }

  const scopeBase =
    normalizeText(access.profile?.idempotency?.idempotency_scope) || "perfect_fit";
  const normalizedAction = normalizeText(action) || "write";
  const scope = `${scopeBase}.${normalizedAction}`;
  const payload = hashPayload === undefined ? body : hashPayload;
  const requestHash = buildRequestHash(
    Buffer.from(JSON.stringify(payload || {}))
  );

  const result = await ensureIdempotency(app.db, {
    tenantId: access.tenant.id,
    scope,
    key: eventId,
    requestHash
  });

  return {
    ...result,
    scope: result.scope || scope,
    key: result.key || eventId
  };
}

async function finalizePerfectFitWriteIdempotency(
  app,
  access,
  idem,
  payload,
  { httpStatus = 200, status = "ok" } = {}
) {
  if (!idem?.scope || !idem?.key) return false;
  const envelope = {
    __perfect_fit_write_v1: true,
    http_status: Number(httpStatus) || 200,
    payload: payload || {}
  };
  try {
    await finalizeIdempotency(app.db, {
      tenantId: access.tenant.id,
      scope: idem.scope,
      key: idem.key,
      response: envelope,
      status
    });
    return true;
  } catch (error) {
    app.log?.error?.({
      event: "perfect_fit_idempotency_finalize_failed",
      tenant_id: access.tenant.id,
      scope: idem.scope,
      error: error?.message || String(error)
    });
    return false;
  }
}

function sendPerfectFitIdempotencyReplay(reply, idem) {
  if (idem?.status === "in_progress" && !idem?.response) {
    return reply.code(409).send({
      ok: false,
      error: "IDEMPOTENCY_IN_PROGRESS"
    });
  }

  const stored = idem?.response;
  if (stored?.__perfect_fit_write_v1 === true) {
    const httpStatus = Math.max(100, Math.min(599, Number(stored.http_status) || 200));
    return reply.code(httpStatus).send(stored.payload || {});
  }

  return reply
    .code(idem?.status === "error" ? 409 : 200)
    .send(stored || { ok: true, replay: true });
}

function idempotencyErrorHttpStatus(error) {
  if (error === "IDEMPOTENCY_CONFLICT") return 409;
  if (error === "IDEMPOTENCY_REQUIRED") return 400;
  if (error === "IDEMPOTENCY_LOOKUP_FAILED") return 503;
  return 500;
}

export {
  beginPerfectFitWriteIdempotency,
  finalizePerfectFitWriteIdempotency,
  idempotencyErrorHttpStatus,
  requireSessionBoundMemberCsrf,
  sendPerfectFitIdempotencyReplay
};
