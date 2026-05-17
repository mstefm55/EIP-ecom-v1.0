function buildEnvelope(opts) {
  const {
    tenantId,
    realm,
    channel,
    actor,
    idempotencyKey,
    message,
    meta
  } = opts;

  return {
    tenant_id: tenantId,
    realm,
    channel,
    actor: actor || {},
    idempotency_key: idempotencyKey || null,
    message: message || {},
    meta: meta || {}
  };
}

export { buildEnvelope };
