async function insertGatewayAudit(client, opts) {
  const {
    tenantId,
    title,
    payload,
    attrs,
    createdByAgentId,
    recordType
  } = opts;

  const r = await client.query(
    `
    INSERT INTO eip_core.info_record
      (tenant_id, record_type, title, payload, attrs, created_by_agent_id)
    VALUES
      ($1,$6,$2,$3::jsonb,$4::jsonb,$5)
    RETURNING id
    `,
    [
      tenantId,
      title || "gateway",
      JSON.stringify(payload || {}),
      JSON.stringify(attrs || {}),
      createdByAgentId || null,
      recordType || "GATEWAY_AUDIT"
    ]
  );
  return r.rows[0]?.id || null;
}

export { insertGatewayAudit };
