// services/api/src/routes/privacy.js
import { hasPermission } from "../auth/perm.js";
import { sha256Hex } from "../auth/crypto.js";

const MAX_EXPORT_SIZE = 50 * 1024 * 1024; // 50MB limit for data exports

async function resolveProcessBinding(client, tenantId, objectType) {
  const r = await client.query(
    `
    SELECT process_def_id
    FROM eip_core.process_binding
    WHERE tenant_id = $1
      AND service_object_type = $2
      AND is_active = true
    ORDER BY priority ASC, created_at DESC
    LIMIT 1
    `,
    [tenantId, objectType]
  );
  return r.rows[0] || null;
}

async function ensureProcessInstance(client, app, opts) {
  const { tenantId, identityId, serviceObjectId, objectType } = opts;
  const active = await app.coreProcess.findActiveInstance(client, tenantId, serviceObjectId);
  if (active) return { ok: true, instance: active };

  const binding = await resolveProcessBinding(client, tenantId, objectType);
  if (!binding) return { ok: false, error: "PROCESS_BINDING_REQUIRED" };

  const started = await app.coreProcess.createInstance(client, {
    tenantId,
    identityId,
    serviceObjectId,
    processDefId: binding.process_def_id,
    idempotencyKey: `auto:${objectType}:${serviceObjectId}`
  });
  if (!started.ok) return { ok: false, error: started.error };
  return { ok: true, instance: started.item };
}

export default async function privacyRoutes(app) {
  // ============================================================
  // GDPR DATA SUBJECT RIGHTS
  // ============================================================

  /* ===================== DATA REQUEST (ACCESS/ERASURE) ===================== */
  app.post("/privacy/data-request", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

    const step = await app.requireStepUp(req);
    if (!step.ok) return reply.code(step.status).send({ ok: false, error: step.error });

    const { request_type, reason } = req.body || {};
    if (!request_type || !["access", "erasure"].includes(request_type)) {
      return reply.code(400).send({ ok: false, error: "INVALID_REQUEST_TYPE" });
    }

    const tenantId = s.session.tenant_id;
    const identityId = s.session.identity_id;

    const client = await app.db.connect();
    try {
      await client.query("BEGIN");

      // Create data request record
      const requestRes = await client.query(
        `
        INSERT INTO eip_core.gdpr_data_request
          (tenant_id, identity_id, request_type, status, reason, requested_at, requested_by)
        VALUES
          ($1, $2, $3, 'pending', $4, now(), $5)
        RETURNING id, request_type, status, requested_at
        `,
        [tenantId, identityId, request_type, reason || null, identityId]
      );

      // For erasure requests, mark identity for review
      if (request_type === "erasure") {
        await client.query(
          `
          UPDATE eip_auth.auth_identity
          SET attrs = COALESCE(attrs, '{}'::jsonb) || jsonb_build_object('gdpr_erasure_pending', true)
          WHERE tenant_id = $1 AND id = $2
          `,
          [tenantId, identityId]
        );
      }

      await client.query("COMMIT");

      // Log the request
      app.log.info({
        event: "gdpr_data_request_created",
        tenantId,
        identityId,
        requestType: request_type,
        requestId: requestRes.rows[0].id
      });

      return reply.send({
        ok: true,
        request: requestRes.rows[0],
        message: request_type === "access"
          ? "Data export request submitted. You will receive an email when ready."
          : "Data erasure request submitted. Our privacy team will review within 30 days."
      });

    } catch (e) {
      await client.query("ROLLBACK");
      app.log.error({ event: "gdpr_data_request_error", tenantId, identityId, error: e.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  /* ===================== DATA EXPORT ===================== */
  app.get("/privacy/data-export/:requestId", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const requestId = req.params.requestId;
    const tenantId = s.session.tenant_id;
    const identityId = s.session.identity_id;

    const client = await app.db.connect();
    try {
      // Verify request ownership and status
      const requestRes = await client.query(
        `
        SELECT id, request_type, status, completed_at, data_size
        FROM eip_core.gdpr_data_request
        WHERE tenant_id = $1 AND id = $2 AND identity_id = $3 AND request_type = 'access'
        `,
        [tenantId, requestId, identityId]
      );

      if (requestRes.rowCount === 0) {
        return reply.code(404).send({ ok: false, error: "REQUEST_NOT_FOUND" });
      }

      const request = requestRes.rows[0];
      if (request.status !== "completed") {
        return reply.code(409).send({
          ok: false,
          error: "EXPORT_NOT_READY",
          status: request.status,
          message: "Your data export is still being prepared."
        });
      }

      // Get the actual data
      const dataRes = await client.query(
        `
        SELECT personal_data
        FROM eip_core.gdpr_data_export
        WHERE tenant_id = $1 AND request_id = $2
        `,
        [tenantId, requestId]
      );

      if (dataRes.rowCount === 0) {
        return reply.code(404).send({ ok: false, error: "EXPORT_DATA_NOT_FOUND" });
      }

      const exportData = dataRes.rows[0].personal_data;

      // Log access
      await client.query(
        `
        INSERT INTO eip_core.info_record
          (tenant_id, record_type, data)
        VALUES ($1, 'gdpr_export_accessed', $2)
        `,
        [tenantId, {
          request_id: requestId,
          identity_id: identityId,
          accessed_at: new Date().toISOString(),
          ip_address: req.ip
        }]
      );

      // Set headers for file download
      reply.header('Content-Type', 'application/json');
      reply.header('Content-Disposition', `attachment; filename="gdpr-data-export-${requestId}.json"`);
      reply.header('X-Content-Type-Options', 'nosniff');

      return reply.send(exportData);

    } catch (e) {
      app.log.error({ event: "gdpr_data_export_error", tenantId, identityId, requestId, error: e.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  /* ===================== DATA ERASURE ===================== */
  app.post("/privacy/data-erasure/:requestId", async (req, reply) => {
    // This endpoint would be used by privacy officers, not users directly
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

    // Check if user has privacy officer permission
    const allowed = await hasPermission(app, s.session.tenant_id, s.session.identity_id, "privacy.erasure.execute");
    if (!allowed) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });

    const requestId = req.params.requestId;
    const { approved, reason } = req.body || {};

    if (typeof approved !== "boolean") {
      return reply.code(400).send({ ok: false, error: "APPROVAL_REQUIRED" });
    }

    const tenantId = s.session.tenant_id;
    const officerId = s.session.identity_id;

    const client = await app.db.connect();
    try {
      await client.query("BEGIN");

      // Get the erasure request
      const requestRes = await client.query(
        `
        SELECT id, identity_id, status
        FROM eip_core.gdpr_data_request
        WHERE tenant_id = $1 AND id = $2 AND request_type = 'erasure'
        `,
        [tenantId, requestId]
      );

      if (requestRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ ok: false, error: "REQUEST_NOT_FOUND" });
      }

      const request = requestRes.rows[0];
      if (request.status !== "pending") {
        await client.query("ROLLBACK");
        return reply.code(409).send({ ok: false, error: "REQUEST_ALREADY_PROCESSED" });
      }

      if (approved) {
        // Perform data erasure (anonymization, not deletion)
        const identityId = request.identity_id;

        // Anonymize identity
        await client.query(
          `
          UPDATE eip_auth.auth_identity
          SET login = CONCAT('erased_', id),
              is_active = false,
              attrs = jsonb_build_object('erased_at', now(), 'erased_by', $2, 'erasure_reason', $3)
          WHERE tenant_id = $1 AND id = $4
          `,
          [tenantId, officerId, reason, identityId]
        );

        // Revoke all sessions
        await client.query(
          `
          UPDATE eip_auth.auth_session
          SET is_revoked = true, revoked_at = now()
          WHERE tenant_id = $1 AND identity_id = $2 AND is_revoked = false
          `,
          [tenantId, identityId]
        );

        // Anonymize service objects via process engine
        const serviceObjects = await client.query(
          `
          SELECT id, object_type
          FROM eip_core.service_object
          WHERE tenant_id = $1 AND owner_agent_id IN (
            SELECT agent_id FROM eip_auth.auth_identity_agent
            WHERE tenant_id = $1 AND identity_id = $2 AND is_primary = true
          )
          `,
          [tenantId, identityId]
        );

        const anonymizeAttrs = {
          anonymized_at: new Date().toISOString(),
          anonymized_by: officerId,
          erasure_reason: reason || null
        };

        for (const row of serviceObjects.rows) {
          const instanceRes = await ensureProcessInstance(client, app, {
            tenantId,
            identityId: officerId,
            serviceObjectId: row.id,
            objectType: row.object_type
          });
          if (!instanceRes.ok) {
            await client.query("ROLLBACK");
            return reply.code(409).send({ ok: false, error: instanceRes.error });
          }

          const payload = {
            title: "Anonymized",
            attrs: anonymizeAttrs
          };
          const idempotencyKey = sha256Hex(`privacy:anonymize:${row.id}`);

          const result = await app.coreProcess.advanceInstance(client, {
            tenantId,
            identityId: officerId,
            instanceId: instanceRes.instance.id,
            action: "anonymize",
            payload,
            idempotencyKey
          });
          if (!result.ok) {
            await client.query("ROLLBACK");
            return reply.code(409).send({ ok: false, error: result.error });
          }
        }

        // Update request status
        await client.query(
          `
          UPDATE eip_core.gdpr_data_request
          SET status = 'completed', completed_at = now(), completed_by = $2, notes = $3
          WHERE tenant_id = $1 AND id = $4
          `,
          [tenantId, officerId, reason, requestId]
        );

      } else {
        // Reject the request
        await client.query(
          `
          UPDATE eip_core.gdpr_data_request
          SET status = 'rejected', completed_at = now(), completed_by = $2, notes = $3
          WHERE tenant_id = $1 AND id = $4
          `,
          [tenantId, officerId, reason, requestId]
        );
      }

      await client.query("COMMIT");

      app.log.info({
        event: "gdpr_erasure_processed",
        tenantId,
        requestId,
        identityId: request.identity_id,
        approved,
        officerId
      });

      return reply.send({
        ok: true,
        message: approved ? "Data erasure completed" : "Erasure request rejected",
        approved
      });

    } catch (e) {
      await client.query("ROLLBACK");
      app.log.error({ event: "gdpr_erasure_error", tenantId, requestId, error: e.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });

  /* ===================== CONSENT MANAGEMENT ===================== */
  app.get("/privacy/consents", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const tenantId = s.session.tenant_id;
    const identityId = s.session.identity_id;

    const consents = await app.db.query(
      `
      SELECT consent_type, granted_at, expires_at, ip_address, user_agent
      FROM eip_core.gdpr_consent
      WHERE tenant_id = $1 AND identity_id = $2
      ORDER BY granted_at DESC
      `,
      [tenantId, identityId]
    );

    return reply.send({ ok: true, consents: consents.rows });
  });

  app.post("/privacy/consents", async (req, reply) => {
    const s = await app.requireSession(req, { realm: "EIP" });
    if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

    const c = await app.requireCsrf(req);
    if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

    const { consent_type, granted } = req.body || {};
    if (!consent_type || typeof granted !== "boolean") {
      return reply.code(400).send({ ok: false, error: "INVALID_CONSENT" });
    }

    const tenantId = s.session.tenant_id;
    const identityId = s.session.identity_id;

    const client = await app.db.connect();
    try {
      await client.query("BEGIN");

      if (granted) {
        // Record consent
        await client.query(
          `
          INSERT INTO eip_core.gdpr_consent
            (tenant_id, identity_id, consent_type, granted_at, ip_address, user_agent)
          VALUES
            ($1, $2, $3, now(), $4, $5)
          ON CONFLICT (tenant_id, identity_id, consent_type)
          DO UPDATE SET
            granted_at = EXCLUDED.granted_at,
            ip_address = EXCLUDED.ip_address,
            user_agent = EXCLUDED.user_agent
          `,
          [tenantId, identityId, consent_type, req.ip, req.headers['user-agent']]
        );
      } else {
        // Withdraw consent
        await client.query(
          `
          DELETE FROM eip_core.gdpr_consent
          WHERE tenant_id = $1 AND identity_id = $2 AND consent_type = $3
          `,
          [tenantId, identityId, consent_type]
        );
      }

      await client.query("COMMIT");

      return reply.send({
        ok: true,
        message: granted ? "Consent granted" : "Consent withdrawn",
        consent_type,
        granted
      });

    } catch (e) {
      await client.query("ROLLBACK");
      app.log.error({ event: "consent_update_error", tenantId, identityId, error: e.message });
      return reply.code(500).send({ ok: false });
    } finally {
      client.release();
    }
  });
}
