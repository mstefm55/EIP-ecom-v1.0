// services/api/src/routes/tenant_requests_admin.js
import crypto from "node:crypto";
import { randomToken, sha256Hex } from "../auth/crypto.js";
import { hasPermission } from "../auth/perm.js";
import { sendEmail } from "../lib/email.js";

const BOOTSTRAP_TOKEN_TTL_MS = 60 * 60 * 1000; // 60 minutes

function normalizeText(value) {
  return String(value || "").trim();
}

function buildTenantCode() {
  return `t_${crypto.randomBytes(6).toString("hex")}`;
}

function buildBootstrapToken() {
  return randomToken(32);
}

function maskEmail(value) {
  const email = String(value || "");
  const at = email.indexOf("@");
  if (at <= 1) return email ? "***" : "";
  return `${email.slice(0, 2)}***${email.slice(at)}`;
}

async function tenantRequestTableExists(app) {
  const r = await app.db.query(
    `
    SELECT to_regclass('eip_core.tenant_request') AS name
    `
  );
  return Boolean(r.rows[0]?.name);
}

async function ensureAdminRole(client, tenantId) {
  const r = await client.query(
    `
    INSERT INTO eip_authz.role(tenant_id, code, label, surface_code, is_system)
    VALUES ($1,'ADMIN_SUPER','Super Admin','ADMIN',true)
    ON CONFLICT (tenant_id, code)
    DO UPDATE SET is_active = true, updated_at = now()
    RETURNING id
    `,
    [tenantId]
  );
  return r.rows[0]?.id;
}

export default async function tenantRequestsAdmin(app) {
  app.get(
    "/admin/tenant-requests",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            status: { type: "string", maxLength: 32 },
            q: { type: "string", maxLength: 200 },
            limit: { type: "integer", minimum: 1, maximum: 200, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 }
          }
        }
      }
    },
    async (req, reply) => {
      const s = await app.requireSession(req, { realm: "EIP" });
      if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

      const allowed = await hasPermission(app, s.session.tenant_id, s.session.identity_id, "tenant.onboarding.read");
      if (!allowed) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });

      const exists = await tenantRequestTableExists(app);
      if (!exists) {
        return reply.send({
          ok: true,
          items: [],
          limit: 0,
          offset: 0,
          total: 0,
          warning: "TENANT_REQUEST_TABLE_MISSING"
        });
      }

      const status = normalizeText(req.query?.status);
      const q = normalizeText(req.query?.q);
      const limit = Number(req.query?.limit || 50);
      const offset = Number(req.query?.offset || 0);

      const params = [];
      const filters = [];

      if (status) {
        params.push(status);
        filters.push(`status_code = $${params.length}`);
      }
      if (q) {
        params.push(`%${q}%`);
        filters.push(`(legal_name ILIKE $${params.length} OR email ILIKE $${params.length})`);
      }

      const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

      let countRes;
      let r;
      try {
        const countParams = params.slice();
        countRes = await app.db.query(
          `
          SELECT count(*)::int AS total
          FROM eip_core.tenant_request
          ${where}
          `,
          countParams
        );

        params.push(limit);
        params.push(offset);

        r = await app.db.query(
          `
          SELECT
            id,
            ref_code,
            status_code,
            applicant_type,
            legal_name,
            business_reg_no,
            personal_id_no,
            email,
            phone,
            country,
            timezone,
            tenant_id,
            admin_identity_id,
            attrs,
            created_at,
            updated_at
          FROM eip_core.tenant_request
          ${where}
          ORDER BY created_at DESC
          LIMIT $${params.length - 1} OFFSET $${params.length}
          `,
          params
        );
      } catch (err) {
        if (String(err?.code) === "42P01") {
          return reply.send({
            ok: true,
            items: [],
            limit: 0,
            offset: 0,
            total: 0,
            warning: "TENANT_REQUEST_TABLE_MISSING"
          });
        }
        throw err;
      }

      return reply.send({
        ok: true,
        items: r?.rows || [],
        limit,
        offset,
        total: countRes?.rows?.[0]?.total ?? 0
      });
    }
  );

  app.post(
    "/admin/tenant-requests/:id/approve",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", minLength: 36, maxLength: 36 } }
        }
      }
    },
    async (req, reply) => {
      const s = await app.requireSession(req, { realm: "EIP" });
      if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

      const c = await app.requireCsrf(req);
      if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

      const step = await app.requireStepUp(req);
      if (!step.ok) return reply.code(step.status).send({ ok: false, error: step.error });

      const allowed = await hasPermission(app, s.session.tenant_id, s.session.identity_id, "tenant.onboarding.approve");
      if (!allowed) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });

      const requestId = req.params.id;
      const client = await app.db.connect();
      try {
        await client.query("BEGIN");

        const reqRes = await client.query(
          `
          SELECT *
          FROM eip_core.tenant_request
          WHERE id = $1::uuid
          FOR UPDATE
          `,
          [requestId]
        );
        if (reqRes.rowCount === 0) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
        }

        const row = reqRes.rows[0];
        if (row.status_code === "REJECTED" || row.status_code === "ACTIVE") {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: "INVALID_STATUS" });
        }

        let tenantId = row.tenant_id;
        let tenantCode = null;
        if (!tenantId) {
          for (let i = 0; i < 5; i += 1) {
            tenantCode = buildTenantCode();
            const tRes = await client.query(
              `
              INSERT INTO eip_core.tenant (code, name, attrs, is_active, status_code)
              VALUES ($1,$2,$3,false,'BOOTSTRAP_PENDING')
              ON CONFLICT (code) DO NOTHING
              RETURNING id
              `,
              [
                tenantCode,
                row.legal_name,
                JSON.stringify({ onboarding_request_id: row.id })
              ]
            );
            if (tRes.rowCount > 0) {
              tenantId = tRes.rows[0].id;
              break;
            }
          }
        }

        if (!tenantId) {
          throw new Error("TENANT_CREATE_FAILED");
        }

        const identityRes = await client.query(
          `
          INSERT INTO eip_auth.auth_identity (tenant_id, login, login_type, attrs)
          VALUES ($1, $2, 'email', $3::jsonb)
          ON CONFLICT (tenant_id, login)
          DO UPDATE SET updated_at = now()
          RETURNING id
          `,
          [tenantId, row.email, JSON.stringify({ bootstrap_admin: true })]
        );

        const adminIdentityId = identityRes.rows[0]?.id;
        if (!adminIdentityId) throw new Error("ADMIN_IDENTITY_CREATE_FAILED");

        const adminRoleId = await ensureAdminRole(client, tenantId);
        if (!adminRoleId) throw new Error("ADMIN_ROLE_CREATE_FAILED");

        await client.query(
          `
          INSERT INTO eip_authz.identity_role (tenant_id, identity_id, role_id, granted_by_identity_id)
          VALUES ($1,$2,$3,NULL)
          ON CONFLICT DO NOTHING
          `,
          [tenantId, adminIdentityId, adminRoleId]
        );

        const token = buildBootstrapToken();
        const tokenHash = sha256Hex(`${token}:${app.config.BOOTSTRAP_TOKEN_PEPPER}`);
        const expiresAt = new Date(Date.now() + BOOTSTRAP_TOKEN_TTL_MS);
        const approvedAt = new Date().toISOString();
        const approvalPayload = {
          request_id: row.id,
          tenant_id: tenantId,
          tenant_code: tenantCode,
          admin_identity_id: s.session.identity_id,
          approved_at: approvedAt,
          applicant_email: row.email,
          applicant_legal_name: row.legal_name,
          consent: row.attrs?.consent ?? null
        };
        const approvalSignature = {
          alg: "sha256",
          hash: sha256Hex(`${JSON.stringify(approvalPayload)}:${app.config.BOOTSTRAP_TOKEN_PEPPER}`)
        };

        await client.query(
          `
          UPDATE eip_core.tenant_request
          SET status_code='BOOTSTRAP_PENDING',
              tenant_id=$2,
              admin_identity_id=$3,
              bootstrap_token_hash=$4,
              bootstrap_expires_at=$5,
              bootstrap_used_at=NULL,
              attrs = COALESCE(attrs,'{}'::jsonb) || jsonb_build_object(
                'review',
                jsonb_build_object(
                  'approved_by', $6::uuid,
                  'approved_at', now(),
                  'approval_payload', $7::jsonb,
                  'approval_signature', jsonb_build_object('alg', $8::text, 'hash', $9::text)
                )
              )
          WHERE id=$1::uuid
          `,
          [
            row.id,
            tenantId,
            adminIdentityId,
            tokenHash,
            expiresAt,
            s.session.identity_id,
            JSON.stringify(approvalPayload),
            approvalSignature.alg,
            approvalSignature.hash
          ]
        );

        const isDev = app.config.NODE_ENV !== "production";

        // Send bootstrap token via email (in production) or return in response (in dev).
        if (!isDev) {
          try {
            const subject = "Your EIP Bootstrap Token";
            const html = `
              <h1>Welcome to EIP</h1>
              <p>Your tenant has been approved. Use the following token to complete the bootstrap process:</p>
              <p><strong>${token}</strong></p>
              <p>This token expires in 60 minutes.</p>
              <p>If you did not request this, please ignore this email.</p>
            `;
            const text = `
Welcome to EIP

Your tenant has been approved. Use the following token to complete the bootstrap process:

${token}

This token expires in 60 minutes.

If you did not request this, please ignore this email.
            `;
            await sendEmail(app, row.email, subject, text, html);
            app.log.info({ event: "bootstrap_token_emailed", requestId: row.id, email: maskEmail(row.email) });
          } catch (emailError) {
            await client.query("ROLLBACK");
            app.log.error({ event: "bootstrap_token_email_failed", requestId: row.id, email: maskEmail(row.email), error: emailError.message });
            return reply.code(502).send({ ok: false, error: "EMAIL_FAILED" });
          }
        }

        await client.query("COMMIT");

        app.log.info({ event: "tenant_request_approved", requestId: row.id, tenantId, adminIdentityId, ip: req.ip });

        return reply.send({
          ok: true,
          requestId: row.id,
          tenantId,
          tenantCode,
          bootstrapExpiresAt: expiresAt.toISOString(),
          ...(isDev ? { bootstrapToken: token } : {}),
          approvalPayload,
          approvalSignature
        });
      } catch (e) {
        await client.query("ROLLBACK");
        app.log.error({ event: "tenant_request_approve_error", requestId, ip: req.ip, error: e.message });
        return reply.code(500).send({ ok: false });
      } finally {
        client.release();
      }
    }
  );

  app.post(
    "/admin/tenant-requests/:id/reject",
    {
      schema: {
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string", minLength: 36, maxLength: 36 } }
        },
        body: {
          type: "object",
          additionalProperties: false,
          properties: {
            reason: { type: "string", maxLength: 500 }
          }
        }
      }
    },
    async (req, reply) => {
      const s = await app.requireSession(req, { realm: "EIP" });
      if (!s.ok) return reply.code(s.status).send({ ok: false, error: s.error });

      const c = await app.requireCsrf(req);
      if (!c.ok) return reply.code(c.status).send({ ok: false, error: c.error });

      const step = await app.requireStepUp(req);
      if (!step.ok) return reply.code(step.status).send({ ok: false, error: step.error });

      const allowed = await hasPermission(app, s.session.tenant_id, s.session.identity_id, "tenant.onboarding.reject");
      if (!allowed) return reply.code(403).send({ ok: false, error: "FORBIDDEN" });

      const requestId = req.params.id;
      const reason = normalizeText(req.body?.reason);

      const r = await app.db.query(
        `
        UPDATE eip_core.tenant_request
        SET status_code='REJECTED',
            attrs = COALESCE(attrs,'{}'::jsonb) || jsonb_build_object(
              'review',
              jsonb_build_object(
                'rejected_by', $2::uuid,
                'rejected_at', now(),
                'reason', $3
              )
            )
        WHERE id=$1::uuid
        RETURNING id
        `,
        [requestId, s.session.identity_id, reason || null]
      );

      if (r.rowCount === 0) {
        return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
      }

      app.log.info({ event: "tenant_request_rejected", requestId, ip: req.ip });
      return reply.send({ ok: true });
    }
  );
}
