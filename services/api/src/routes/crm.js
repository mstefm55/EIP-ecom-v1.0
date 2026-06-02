// services/api/src/routes/crm.js
import { hasPermission } from "../auth/perm.js";
import { sha256Hex } from "../auth/crypto.js";
import registerCrmCompletionRoutes from "./crm_completion.js";
import registerCrmIntelligenceRoutes from "./crm_intelligence.js";
import registerCrmIntakeRoutes from "./crm_intake.js";
import registerCrmMailboxRoutes from "./crm_mailbox.js";

const MAX_LIMIT = 200;

const INTERACTION_CHANNELS = [
  "EMAIL",
  "PHONE",
  "WHATSAPP",
  "INSTAGRAM",
  "FACEBOOK",
  "MEETING",
  "WEBFORM"
];

const INTERACTION_DIRECTIONS = ["IN", "OUT"];

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeOptionalText(value) {
  const trimmed = normalizeText(value);
  return trimmed.length ? trimmed : null;
}

function normalizeStatus(value) {
  return normalizeText(value).toLowerCase();
}

function buildIdempotencyKey(prefix, payload) {
  return sha256Hex(`${prefix}:${JSON.stringify(payload || {})}`);
}

function clampLimit(value) {
  const n = Number(value || 50);
  if (!Number.isFinite(n)) return 50;
  return Math.max(1, Math.min(MAX_LIMIT, n));
}

async function requirePerm(app, req, reply, permCode) {
  const s = await app.requireSession(req, { realm: "EIP" });
  if (!s.ok) {
    reply.code(s.status).send({ ok: false, error: s.error });
    return null;
  }

  const c = await app.requireCsrf(req);
  if (!c.ok) {
    reply.code(c.status).send({ ok: false, error: c.error });
    return null;
  }

  const allowed = await hasPermission(app, s.session.tenant_id, s.session.identity_id, permCode);
  if (!allowed) {
    reply.code(403).send({ ok: false, error: "FORBIDDEN" });
    return null;
  }

  return s.session;
}

async function getPrimaryAgentId(client, tenantId, identityId) {
  const r = await client.query(
    `
    SELECT agent_id
    FROM eip_auth.auth_identity_agent
    WHERE tenant_id=$1
      AND identity_id=$2
      AND is_primary=true
      AND is_active=true
    LIMIT 1
    `,
    [tenantId, identityId]
  );
  return r.rows[0]?.agent_id ?? null;
}

async function ensureAgent(client, tenantId, agentId) {
  const r = await client.query(
    `
    SELECT id, agent_type
    FROM eip_core.agent
    WHERE tenant_id=$1 AND id=$2
    `,
    [tenantId, agentId]
  );
  return r.rows[0] || null;
}

async function findDropdownListId(client, tenantId, listCode) {
  const r = await client.query(
    `
    SELECT id
    FROM eip_core.dropdown_list
    WHERE code=$1
      AND is_active=true
      AND (tenant_id=$2 OR tenant_id IS NULL)
    ORDER BY (tenant_id IS NOT NULL) DESC, version DESC
    LIMIT 1
    `,
    [listCode, tenantId]
  );
  return r.rows[0]?.id ?? null;
}

async function validateStatus(client, tenantId, listCode, statusCode) {
  const listId = await findDropdownListId(client, tenantId, listCode);
  if (!listId) return { ok: false, error: "STATUS_LIST_MISSING" };

  const r = await client.query(
    `
    SELECT 1
    FROM eip_core.dropdown_value
    WHERE list_id=$1 AND code=$2 AND is_active=true
    LIMIT 1
    `,
    [listId, statusCode]
  );
  if (r.rowCount === 0) return { ok: false, error: "INVALID_STATUS" };
  return { ok: true };
}

async function resolveProcessBinding(client, tenantId, objectType) {
  const r = await client.query(
    `
    SELECT process_def_id, attrs
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

async function startProcessFor(client, app, opts) {
  const { tenantId, identityId, objectType, serviceObject, serviceObjectId, requireBinding } = opts;
  const binding = await resolveProcessBinding(client, tenantId, objectType);
  if (!binding) {
    if (requireBinding) return { ok: false, error: "PROCESS_BINDING_REQUIRED" };
    await client.query(
      `
      INSERT INTO eip_core.info_record
        (tenant_id, record_type, title, payload)
      VALUES
        ($1,$2,$3,$4::jsonb)
      `,
      [
        tenantId,
        "PROCESS_BINDING_MISSING",
        `process_binding.${objectType}`,
        JSON.stringify({ service_object_id: serviceObjectId || null, object_type: objectType })
      ]
    );
    return { ok: true, skipped: true };
  }

  const result = await app.coreProcess.createInstance(client, {
    tenantId,
    identityId,
    serviceObjectId,
    serviceObject,
    processDefId: binding.process_def_id,
    idempotencyKey: serviceObjectId ? `auto:${objectType}:${serviceObjectId}` : null
  });
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    instance: result.item,
    service_object: result.service_object || null,
    reused: result.reused === true
  };
}

async function ensureProcessInstance(client, app, opts) {
  const { tenantId, identityId, serviceObjectId, objectType } = opts;
  const active = await app.coreProcess.findActiveInstance(client, tenantId, serviceObjectId);
  if (active) return { ok: true, instance: active };

  const started = await startProcessFor(client, app, {
    tenantId,
    identityId,
    objectType,
    serviceObjectId,
    requireBinding: true
  });
  if (!started.ok) return started;
  if (!started.instance) return { ok: false, error: "PROCESS_INSTANCE_REQUIRED" };
  return { ok: true, instance: started.instance };
}

export default async function crmRoutes(app) {
  // ==========================================================
  // Agents
  // ==========================================================
  app.get(
    "/agents",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            agent_type: { type: "string", maxLength: 50 },
            q: { type: "string", maxLength: 200 },
            limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "CRM_AGENT_READ");
      if (!session) return;

      const tenantId = session.tenant_id;
      const agentType = normalizeOptionalText(req.query?.agent_type);
      const q = normalizeOptionalText(req.query?.q);
      const limit = clampLimit(req.query?.limit);
      const offset = Number(req.query?.offset || 0);

      const params = [tenantId];
      const filters = ["tenant_id = $1"];

      if (agentType) {
        params.push(agentType);
        filters.push(`agent_type = $${params.length}`);
      }
      if (q) {
        params.push(`%${q}%`);
        filters.push(`(name ILIKE $${params.length} OR code ILIKE $${params.length})`);
      }

      params.push(limit);
      params.push(offset);

      const r = await app.db.query(
        `
        SELECT id, agent_type, code, name, attrs, parent_agent_id, is_active, created_at, updated_at
        FROM eip_core.agent
        WHERE ${filters.join(" AND ")}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
        `,
        params
      );

      return reply.send({ ok: true, items: r.rows, limit, offset });
    }
  );

  app.post(
    "/agents",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["agent_type"],
          properties: {
            agent_type: { type: "string", minLength: 2, maxLength: 50 },
            code: { type: "string", maxLength: 64 },
            name: { type: "string", maxLength: 200 },
            parent_agent_id: { type: "string", minLength: 36, maxLength: 36 },
            is_active: { type: "boolean" },
            attrs: { type: "object" }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "CRM_AGENT_WRITE");
      if (!session) return;

      const tenantId = session.tenant_id;
      const body = req.body || {};
      const agentType = normalizeText(body.agent_type);
      const code = normalizeOptionalText(body.code);
      const name = normalizeOptionalText(body.name);
      const parentAgentId = normalizeOptionalText(body.parent_agent_id);
      const isActive = typeof body.is_active === "boolean" ? body.is_active : true;
      const attrs = body.attrs && typeof body.attrs === "object" ? body.attrs : {};

      if (parentAgentId) {
        const parent = await ensureAgent(app.db, tenantId, parentAgentId);
        if (!parent) return reply.code(404).send({ ok: false, error: "PARENT_NOT_FOUND" });
      }

      const r = await app.db.query(
        `
        INSERT INTO eip_core.agent
          (tenant_id, agent_type, code, name, attrs, parent_agent_id, is_active)
        VALUES
          ($1,$2,$3,$4,$5::jsonb,$6,$7)
        RETURNING id, agent_type, code, name, attrs, parent_agent_id, is_active, created_at, updated_at
        `,
        [tenantId, agentType, code, name, JSON.stringify(attrs), parentAgentId, isActive]
      );

      return reply.send({ ok: true, item: r.rows[0] });
    }
  );

  app.get(
    "/agents/:id",
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
      const session = await requirePerm(app, req, reply, "CRM_AGENT_READ");
      if (!session) return;

      const r = await app.db.query(
        `
        SELECT id, agent_type, code, name, attrs, parent_agent_id, is_active, created_at, updated_at
        FROM eip_core.agent
        WHERE tenant_id=$1 AND id=$2
        `,
        [session.tenant_id, req.params.id]
      );
      if (r.rowCount === 0) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
      return reply.send({ ok: true, item: r.rows[0] });
    }
  );

  app.patch(
    "/agents/:id",
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
            agent_type: { type: "string", minLength: 2, maxLength: 50 },
            code: { type: "string", maxLength: 64 },
            name: { type: "string", maxLength: 200 },
            parent_agent_id: { type: "string", minLength: 36, maxLength: 36 },
            is_active: { type: "boolean" },
            attrs: { type: "object" }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "CRM_AGENT_WRITE");
      if (!session) return;

      const tenantId = session.tenant_id;
      const body = req.body || {};
      const agentType = body.agent_type !== undefined ? normalizeText(body.agent_type) : null;
      const code = body.code !== undefined ? normalizeOptionalText(body.code) : null;
      const name = body.name !== undefined ? normalizeOptionalText(body.name) : null;
      const parentAgentId = body.parent_agent_id !== undefined ? normalizeOptionalText(body.parent_agent_id) : null;
      const isActive = body.is_active !== undefined ? Boolean(body.is_active) : null;
      const attrs = body.attrs && typeof body.attrs === "object" ? body.attrs : null;

      if (parentAgentId) {
        const parent = await ensureAgent(app.db, tenantId, parentAgentId);
        if (!parent) return reply.code(404).send({ ok: false, error: "PARENT_NOT_FOUND" });
      }

      const r = await app.db.query(
        `
        UPDATE eip_core.agent
        SET agent_type = COALESCE($3, agent_type),
            code = COALESCE($4, code),
            name = COALESCE($5, name),
            parent_agent_id = COALESCE($6, parent_agent_id),
            is_active = COALESCE($7, is_active),
            attrs = COALESCE(attrs,'{}'::jsonb) || COALESCE($8::jsonb, '{}'::jsonb),
            updated_at = now()
        WHERE tenant_id=$1 AND id=$2
        RETURNING id, agent_type, code, name, attrs, parent_agent_id, is_active, created_at, updated_at
        `,
        [
          tenantId,
          req.params.id,
          agentType,
          code,
          name,
          parentAgentId,
          isActive,
          attrs ? JSON.stringify(attrs) : null
        ]
      );
      if (r.rowCount === 0) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
      return reply.send({ ok: true, item: r.rows[0] });
    }
  );

  app.post(
    "/agents/:id/contacts",
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
          required: ["contact_type", "value"],
          properties: {
            contact_type: { type: "string", minLength: 2, maxLength: 50 },
            label: { type: "string", maxLength: 100 },
            value: { type: "string", minLength: 2, maxLength: 200 },
            is_primary: { type: "boolean" },
            is_active: { type: "boolean" },
            attrs: { type: "object" }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "CRM_AGENT_WRITE");
      if (!session) return;

      const tenantId = session.tenant_id;
      const agent = await ensureAgent(app.db, tenantId, req.params.id);
      if (!agent) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });

      const body = req.body || {};
      const r = await app.db.query(
        `
        INSERT INTO eip_core.entity_contact
          (tenant_id, entity_id, contact_type, label, value, is_primary, is_active, attrs)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
        RETURNING id, contact_type, label, value, is_primary, is_active, attrs, created_at, updated_at
        `,
        [
          tenantId,
          req.params.id,
          normalizeText(body.contact_type),
          normalizeOptionalText(body.label),
          normalizeText(body.value),
          body.is_primary === true,
          body.is_active !== false,
          JSON.stringify(body.attrs || {})
        ]
      );
      return reply.send({ ok: true, item: r.rows[0] });
    }
  );

  app.post(
    "/agents/:id/addresses",
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
            address_type: { type: "string", maxLength: 50 },
            label: { type: "string", maxLength: 100 },
            line1: { type: "string", maxLength: 200 },
            line2: { type: "string", maxLength: 200 },
            city: { type: "string", maxLength: 100 },
            state_region: { type: "string", maxLength: 100 },
            postal_code: { type: "string", maxLength: 20 },
            country_code: { type: "string", minLength: 2, maxLength: 2 },
            latitude: { type: "number" },
            longitude: { type: "number" },
            is_primary: { type: "boolean" },
            is_active: { type: "boolean" },
            attrs: { type: "object" }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "CRM_AGENT_WRITE");
      if (!session) return;

      const tenantId = session.tenant_id;
      const agent = await ensureAgent(app.db, tenantId, req.params.id);
      if (!agent) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });

      const body = req.body || {};
      const r = await app.db.query(
        `
        INSERT INTO eip_core.entity_address
          (tenant_id, entity_id, address_type, label,
           line1, line2, city, state_region, postal_code, country_code,
           latitude, longitude, is_primary, is_active, attrs)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)
        RETURNING id, address_type, label, line1, line2, city, state_region, postal_code, country_code,
                  latitude, longitude, is_primary, is_active, attrs, created_at, updated_at
        `,
        [
          tenantId,
          req.params.id,
          normalizeOptionalText(body.address_type) || "main",
          normalizeOptionalText(body.label),
          normalizeOptionalText(body.line1),
          normalizeOptionalText(body.line2),
          normalizeOptionalText(body.city),
          normalizeOptionalText(body.state_region),
          normalizeOptionalText(body.postal_code),
          normalizeOptionalText(body.country_code),
          body.latitude ?? null,
          body.longitude ?? null,
          body.is_primary === true,
          body.is_active !== false,
          JSON.stringify(body.attrs || {})
        ]
      );
      return reply.send({ ok: true, item: r.rows[0] });
    }
  );

  app.post(
    "/agents/:id/bank-accounts",
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
            account_type: { type: "string", maxLength: 50 },
            label: { type: "string", maxLength: 100 },
            bank_name: { type: "string", maxLength: 120 },
            account_name: { type: "string", maxLength: 200 },
            account_number: { type: "string", maxLength: 120 },
            iban: { type: "string", maxLength: 120 },
            swift_bic: { type: "string", maxLength: 50 },
            currency_code: { type: "string", minLength: 3, maxLength: 3 },
            is_primary: { type: "boolean" },
            is_active: { type: "boolean" },
            attrs: { type: "object" }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "CRM_AGENT_WRITE");
      if (!session) return;

      const tenantId = session.tenant_id;
      const agent = await ensureAgent(app.db, tenantId, req.params.id);
      if (!agent) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });

      const body = req.body || {};
      const r = await app.db.query(
        `
        INSERT INTO eip_core.entity_bank_account
          (tenant_id, entity_id, account_type, label, bank_name, account_name,
           account_number, iban, swift_bic, currency_code, is_primary, is_active, attrs)
        VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)
        RETURNING id, account_type, label, bank_name, account_name, account_number,
                  iban, swift_bic, currency_code, is_primary, is_active, attrs, created_at, updated_at
        `,
        [
          tenantId,
          req.params.id,
          normalizeOptionalText(body.account_type) || "bank",
          normalizeOptionalText(body.label),
          normalizeOptionalText(body.bank_name),
          normalizeOptionalText(body.account_name),
          normalizeOptionalText(body.account_number),
          normalizeOptionalText(body.iban),
          normalizeOptionalText(body.swift_bic),
          normalizeOptionalText(body.currency_code),
          body.is_primary === true,
          body.is_active !== false,
          JSON.stringify(body.attrs || {})
        ]
      );
      return reply.send({ ok: true, item: r.rows[0] });
    }
  );

  // ==========================================================
  // Interactions
  // ==========================================================
  app.post(
    "/interactions",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["customer_agent_id", "channel", "direction"],
          properties: {
            customer_agent_id: { type: "string", minLength: 36, maxLength: 36 },
            contact_agent_id: { type: "string", minLength: 36, maxLength: 36 },
            channel: { type: "string", enum: INTERACTION_CHANNELS },
            direction: { type: "string", enum: INTERACTION_DIRECTIONS },
            subject: { type: "string", maxLength: 200 },
            body_text: { type: "string", maxLength: 5000 },
            body_structured: { type: "object" },
            priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
            occurred_at: { type: "string", maxLength: 40 },
            external_ref: { type: "string", maxLength: 200 },
            attachments: { type: "array", maxItems: 50, items: { type: "object" } },
            idempotency_key: { type: "string", maxLength: 200 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "CRM_INTERACTION_WRITE");
      if (!session) return;

      const tenantId = session.tenant_id;
      const body = req.body || {};
      const customerAgentId = normalizeText(body.customer_agent_id);
      const contactAgentId = normalizeOptionalText(body.contact_agent_id);

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");

        const customer = await ensureAgent(client, tenantId, customerAgentId);
        if (!customer) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "CUSTOMER_NOT_FOUND" });
        }

        if (contactAgentId) {
          const contact = await ensureAgent(client, tenantId, contactAgentId);
          if (!contact) {
            await client.query("ROLLBACK");
            return reply.code(404).send({ ok: false, error: "CONTACT_NOT_FOUND" });
          }
        }

        const ownerAgentId = await getPrimaryAgentId(client, tenantId, session.identity_id);

        const attrs = {
          channel: body.channel,
          direction: body.direction,
          subject: normalizeOptionalText(body.subject),
          body_text: normalizeOptionalText(body.body_text),
          body_structured: body.body_structured || {},
          priority: body.priority || "MEDIUM",
          occurred_at: body.occurred_at || new Date().toISOString(),
          external_ref: normalizeOptionalText(body.external_ref),
          attachments: Array.isArray(body.attachments) ? body.attachments : []
        };

        const serviceObject = {
          object_type: "CRM_INTERACTION",
          status: "new",
          title: attrs.subject || "Interaction",
          attrs,
          owner_agent_id: ownerAgentId,
          parties: [
            { role: "CUSTOMER", agent_id: customerAgentId },
            ...(ownerAgentId ? [{ role: "OWNER", agent_id: ownerAgentId }] : []),
            ...(contactAgentId ? [{ role: "CONTACT", agent_id: contactAgentId }] : [])
          ]
        };

        const processStart = await startProcessFor(client, app, {
          tenantId,
          identityId: session.identity_id,
          objectType: "CRM_INTERACTION",
          serviceObject,
          requireBinding: true
        });
        if (!processStart.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: processStart.error });
        }

        await client.query("COMMIT");
        return reply.send({ ok: true, item: processStart.service_object });
      } catch (e) {
        await client.query("ROLLBACK");
        app.log.error({ event: "crm_interaction_create_error", tenantId, error: e.message });
        return reply.code(500).send({ ok: false });
      } finally {
        client.release();
      }
    }
  );

  app.get(
    "/interactions",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            agent_id: { type: "string", minLength: 36, maxLength: 36 },
            channel: { type: "string", maxLength: 20 },
            from: { type: "string", maxLength: 40 },
            to: { type: "string", maxLength: 40 },
            limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "CRM_INTERACTION_READ");
      if (!session) return;

      const tenantId = session.tenant_id;
      const agentId = normalizeOptionalText(req.query?.agent_id);
      const channel = normalizeOptionalText(req.query?.channel);
      const from = normalizeOptionalText(req.query?.from);
      const to = normalizeOptionalText(req.query?.to);
      const limit = clampLimit(req.query?.limit);
      const offset = Number(req.query?.offset || 0);

      const params = [tenantId];
      const filters = [
        "so.tenant_id = $1",
        "so.object_type = 'CRM_INTERACTION'"
      ];

      if (channel) {
        params.push(channel);
        filters.push(`so.attrs->>'channel' = $${params.length}`);
      }
      if (agentId) {
        params.push(agentId);
        filters.push(
          `EXISTS (
            SELECT 1
            FROM eip_core.service_object_party sop
            WHERE sop.tenant_id = so.tenant_id
              AND sop.service_object_id = so.id
              AND sop.role = 'CUSTOMER'
              AND sop.agent_id = $${params.length}
          )`
        );
      }
      if (from) {
        params.push(from);
        filters.push(
          `COALESCE((so.attrs->>'occurred_at')::timestamptz, so.created_at) >= $${params.length}`
        );
      }
      if (to) {
        params.push(to);
        filters.push(
          `COALESCE((so.attrs->>'occurred_at')::timestamptz, so.created_at) <= $${params.length}`
        );
      }

      params.push(limit);
      params.push(offset);

      const r = await app.db.query(
        `
        SELECT so.id, so.status, so.title, so.attrs, so.owner_agent_id, so.created_at, so.updated_at
        FROM eip_core.service_object so
        WHERE ${filters.join(" AND ")}
        ORDER BY so.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
        `,
        params
      );

      return reply.send({ ok: true, items: r.rows, limit, offset });
    }
  );

  app.get(
    "/interactions/:id",
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
      const session = await requirePerm(app, req, reply, "CRM_INTERACTION_READ");
      if (!session) return;

      const r = await app.db.query(
        `
        SELECT id, status, title, attrs, owner_agent_id, created_at, updated_at
        FROM eip_core.service_object
        WHERE tenant_id=$1 AND id=$2 AND object_type='CRM_INTERACTION'
        `,
        [session.tenant_id, req.params.id]
      );
      if (r.rowCount === 0) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });

      const parties = await app.db.query(
        `
        SELECT agent_id, role, attrs, created_at
        FROM eip_core.service_object_party
        WHERE tenant_id=$1 AND service_object_id=$2
        ORDER BY created_at ASC
        `,
        [session.tenant_id, req.params.id]
      );

      return reply.send({ ok: true, item: r.rows[0], parties: parties.rows });
    }
  );

  app.patch(
    "/interactions/:id",
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
            subject: { type: "string", maxLength: 200 },
            body_text: { type: "string", maxLength: 5000 },
            body_structured: { type: "object" },
            priority: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
            occurred_at: { type: "string", maxLength: 40 },
            external_ref: { type: "string", maxLength: 200 },
            attachments: { type: "array", maxItems: 50, items: { type: "object" } },
            idempotency_key: { type: "string", maxLength: 200 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "CRM_INTERACTION_WRITE");
      if (!session) return;

      const attrs = {};
      if (req.body?.subject) attrs.subject = normalizeOptionalText(req.body.subject);
      if (req.body?.body_text) attrs.body_text = normalizeOptionalText(req.body.body_text);
      if (req.body?.body_structured) attrs.body_structured = req.body.body_structured;
      if (req.body?.priority) attrs.priority = req.body.priority;
      if (req.body?.occurred_at) attrs.occurred_at = req.body.occurred_at;
      if (req.body?.external_ref) attrs.external_ref = normalizeOptionalText(req.body.external_ref);
      if (req.body?.attachments) attrs.attachments = req.body.attachments;

      const title = req.body?.subject ? normalizeOptionalText(req.body.subject) : null;
      if (!title && Object.keys(attrs).length === 0) {
        return reply.code(400).send({ ok: false, error: "NO_CHANGES" });
      }

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");

        const soRes = await client.query(
          `
          SELECT id
          FROM eip_core.service_object
          WHERE tenant_id=$1 AND id=$2 AND object_type='CRM_INTERACTION'
          `,
          [session.tenant_id, req.params.id]
        );
        if (soRes.rowCount === 0) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
        }

        const instanceRes = await ensureProcessInstance(client, app, {
          tenantId: session.tenant_id,
          identityId: session.identity_id,
          serviceObjectId: req.params.id,
          objectType: "CRM_INTERACTION"
        });
        if (!instanceRes.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: instanceRes.error });
        }

        const payload = { title, attrs };
        const idempotencyKey =
          normalizeOptionalText(req.body?.idempotency_key) ||
          buildIdempotencyKey("crm_interaction_update", payload);

        const result = await app.coreProcess.advanceInstance(client, {
          tenantId: session.tenant_id,
          identityId: session.identity_id,
          instanceId: instanceRes.instance.id,
          action: "update",
          payload,
          idempotencyKey
        });
        if (!result.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: result.error });
        }

        await client.query("COMMIT");
        return reply.send({ ok: true, reused: result.reused === true });
      } catch (e) {
        await client.query("ROLLBACK");
        app.log.error({ event: "crm_interaction_update_error", tenantId: session.tenant_id, error: e.message });
        return reply.code(500).send({ ok: false });
      } finally {
        client.release();
      }
    }
  );

  app.post(
    "/interactions/:id/tasks",
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
          required: ["task_type"],
          properties: {
            task_type: { type: "string", minLength: 2, maxLength: 50 },
            status: { type: "string", maxLength: 50 },
            title: { type: "string", maxLength: 200 },
            description: { type: "string", maxLength: 2000 },
            assigned_agent_id: { type: "string", minLength: 36, maxLength: 36 },
            due_at: { type: "string", maxLength: 40 },
            payload: { type: "object" },
            attrs: { type: "object" },
            idempotency_key: { type: "string", maxLength: 200 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "CRM_TASK_WRITE");
      if (!session) return;

      const tenantId = session.tenant_id;
      const serviceObjectId = req.params.id;

      const soRes = await app.db.query(
        `
        SELECT id
        FROM eip_core.service_object
        WHERE tenant_id=$1 AND id=$2 AND object_type='CRM_INTERACTION'
        `,
        [tenantId, serviceObjectId]
      );
      if (soRes.rowCount === 0) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });

      if (req.body?.assigned_agent_id) {
        const agent = await ensureAgent(app.db, tenantId, req.body.assigned_agent_id);
        if (!agent) return reply.code(404).send({ ok: false, error: "ASSIGNEE_NOT_FOUND" });
      }

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");

        const instanceRes = await ensureProcessInstance(client, app, {
          tenantId,
          identityId: session.identity_id,
          serviceObjectId,
          objectType: "CRM_INTERACTION"
        });
        if (!instanceRes.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: instanceRes.error });
        }

        const payload = {
          task_type: normalizeText(req.body.task_type),
          status: normalizeOptionalText(req.body.status),
          title: normalizeOptionalText(req.body.title),
          description: normalizeOptionalText(req.body.description),
          assigned_agent_id: normalizeOptionalText(req.body.assigned_agent_id),
          due_at: normalizeOptionalText(req.body.due_at),
          payload: req.body.payload || {},
          attrs: req.body.attrs || {}
        };

        const idempotencyKey =
          normalizeOptionalText(req.body?.idempotency_key) ||
          buildIdempotencyKey("crm_task_create", { serviceObjectId, payload });

        const result = await app.coreProcess.advanceInstance(client, {
          tenantId,
          identityId: session.identity_id,
          instanceId: instanceRes.instance.id,
          action: "task.create",
          payload,
          idempotencyKey
        });
        if (!result.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: result.error });
        }

        await client.query("COMMIT");
        const created = (result.entry?.effects_applied || []).filter(
          (effect) => effect.type === "TASK_CREATE"
        );
        return reply.send({ ok: true, created, reused: result.reused === true });
      } catch (e) {
        await client.query("ROLLBACK");
        app.log.error({ event: "crm_task_create_error", tenantId, error: e.message });
        return reply.code(500).send({ ok: false });
      } finally {
        client.release();
      }
    }
  );

  // ==========================================================
  // Cases
  // ==========================================================
  app.post(
    "/cases",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["customer_agent_id"],
          properties: {
            customer_agent_id: { type: "string", minLength: 36, maxLength: 36 },
            case_type: { type: "string", enum: ["COMPLAINT", "REQUEST", "RETURN", "SUPPORT"] },
            severity: { type: "string", maxLength: 50 },
            sla_target_at: { type: "string", maxLength: 40 },
            tags: { type: "array", maxItems: 20, items: { type: "string", maxLength: 50 } },
            title: { type: "string", maxLength: 200 },
            description: { type: "string", maxLength: 2000 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "CRM_CASE_WRITE");
      if (!session) return;

      const tenantId = session.tenant_id;
      const body = req.body || {};
      const customerAgentId = normalizeText(body.customer_agent_id);

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");

        const customer = await ensureAgent(client, tenantId, customerAgentId);
        if (!customer) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "CUSTOMER_NOT_FOUND" });
        }

        const ownerAgentId = await getPrimaryAgentId(client, tenantId, session.identity_id);

        const attrs = {
          case_type: body.case_type || "REQUEST",
          severity: normalizeOptionalText(body.severity),
          sla_target_at: normalizeOptionalText(body.sla_target_at),
          tags: Array.isArray(body.tags) ? body.tags : []
        };

        const serviceObject = {
          object_type: "CRM_CASE",
          status: "new",
          title: normalizeOptionalText(body.title) || "Case",
          attrs,
          owner_agent_id: ownerAgentId,
          parties: [
            { role: "CUSTOMER", agent_id: customerAgentId },
            ...(ownerAgentId ? [{ role: "OWNER", agent_id: ownerAgentId }] : [])
          ]
        };

        const processStart = await startProcessFor(client, app, {
          tenantId,
          identityId: session.identity_id,
          objectType: "CRM_CASE",
          serviceObject,
          requireBinding: true
        });
        if (!processStart.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: processStart.error });
        }

        await client.query("COMMIT");
        return reply.send({ ok: true, item: processStart.service_object });
      } catch (e) {
        await client.query("ROLLBACK");
        app.log.error({ event: "crm_case_create_error", tenantId, error: e.message });
        return reply.code(500).send({ ok: false });
      } finally {
        client.release();
      }
    }
  );

  app.get(
    "/cases",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            status: { type: "string", maxLength: 50 },
            agent_id: { type: "string", minLength: 36, maxLength: 36 },
            limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "CRM_CASE_READ");
      if (!session) return;

      const tenantId = session.tenant_id;
      const status = normalizeOptionalText(req.query?.status);
      const agentId = normalizeOptionalText(req.query?.agent_id);
      const limit = clampLimit(req.query?.limit);
      const offset = Number(req.query?.offset || 0);

      const params = [tenantId];
      const filters = [
        "so.tenant_id = $1",
        "so.object_type = 'CRM_CASE'"
      ];

      if (status) {
        params.push(normalizeStatus(status));
        filters.push(`so.status = $${params.length}`);
      }
      if (agentId) {
        params.push(agentId);
        filters.push(
          `EXISTS (
            SELECT 1
            FROM eip_core.service_object_party sop
            WHERE sop.tenant_id = so.tenant_id
              AND sop.service_object_id = so.id
              AND sop.role = 'CUSTOMER'
              AND sop.agent_id = $${params.length}
          )`
        );
      }

      params.push(limit);
      params.push(offset);

      const r = await app.db.query(
        `
        SELECT so.id, so.status, so.title, so.attrs, so.owner_agent_id, so.created_at, so.updated_at
        FROM eip_core.service_object so
        WHERE ${filters.join(" AND ")}
        ORDER BY so.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
        `,
        params
      );

      return reply.send({ ok: true, items: r.rows, limit, offset });
    }
  );

  app.get(
    "/cases/:id",
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
      const session = await requirePerm(app, req, reply, "CRM_CASE_READ");
      if (!session) return;

      const r = await app.db.query(
        `
        SELECT id, status, title, attrs, owner_agent_id, created_at, updated_at
        FROM eip_core.service_object
        WHERE tenant_id=$1 AND id=$2 AND object_type='CRM_CASE'
        `,
        [session.tenant_id, req.params.id]
      );
      if (r.rowCount === 0) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
      return reply.send({ ok: true, item: r.rows[0] });
    }
  );

  app.post(
    "/cases/:id/status",
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
          required: ["to_status"],
          properties: {
            to_status: { type: "string", minLength: 1, maxLength: 50 },
            reason_code: { type: "string", maxLength: 50 },
            note: { type: "string", maxLength: 500 },
            idempotency_key: { type: "string", maxLength: 200 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "CRM_CASE_WRITE");
      if (!session) return;

      const toStatus = normalizeStatus(req.body?.to_status);
      const reasonCode = normalizeOptionalText(req.body?.reason_code);
      const note = normalizeOptionalText(req.body?.note);
      const idempotencyKey =
        normalizeOptionalText(req.body?.idempotency_key) ||
        buildIdempotencyKey("crm_case_status", { toStatus, reasonCode, note });

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");

        const soRes = await client.query(
          `
          SELECT id
          FROM eip_core.service_object
          WHERE tenant_id=$1 AND id=$2 AND object_type='CRM_CASE'
          `,
          [session.tenant_id, req.params.id]
        );
        if (soRes.rowCount === 0) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
        }

        const instanceRes = await ensureProcessInstance(client, app, {
          tenantId: session.tenant_id,
          identityId: session.identity_id,
          serviceObjectId: req.params.id,
          objectType: "CRM_CASE"
        });
        if (!instanceRes.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: instanceRes.error });
        }

        const result = await app.coreProcess.advanceInstance(client, {
          tenantId: session.tenant_id,
          identityId: session.identity_id,
          instanceId: instanceRes.instance.id,
          action: toStatus,
          payload: { to_status: toStatus, reason_code: reasonCode, note },
          idempotencyKey
        });
        if (!result.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: result.error });
        }

        await client.query("COMMIT");
        return reply.send({ ok: true, reused: result.reused === true });
      } catch (e) {
        await client.query("ROLLBACK");
        app.log.error({ event: "crm_case_status_error", tenantId: session.tenant_id, error: e.message });
        return reply.code(500).send({ ok: false });
      } finally {
        client.release();
      }
    }
  );

  app.post(
    "/cases/:id/tasks",
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
          required: ["task_type"],
          properties: {
            task_type: { type: "string", minLength: 2, maxLength: 50 },
            status: { type: "string", maxLength: 50 },
            title: { type: "string", maxLength: 200 },
            description: { type: "string", maxLength: 2000 },
            assigned_agent_id: { type: "string", minLength: 36, maxLength: 36 },
            due_at: { type: "string", maxLength: 40 },
            payload: { type: "object" },
            attrs: { type: "object" },
            idempotency_key: { type: "string", maxLength: 200 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "CRM_TASK_WRITE");
      if (!session) return;

      const tenantId = session.tenant_id;
      const serviceObjectId = req.params.id;

      const soRes = await app.db.query(
        `
        SELECT id
        FROM eip_core.service_object
        WHERE tenant_id=$1 AND id=$2 AND object_type='CRM_CASE'
        `,
        [tenantId, serviceObjectId]
      );
      if (soRes.rowCount === 0) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });

      if (req.body?.assigned_agent_id) {
        const agent = await ensureAgent(app.db, tenantId, req.body.assigned_agent_id);
        if (!agent) return reply.code(404).send({ ok: false, error: "ASSIGNEE_NOT_FOUND" });
      }

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");
        const instanceRes = await ensureProcessInstance(client, app, {
          tenantId,
          identityId: session.identity_id,
          serviceObjectId,
          objectType: "CRM_CASE"
        });
        if (!instanceRes.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: instanceRes.error });
        }

        const payload = {
          task_type: normalizeText(req.body.task_type),
          status: normalizeOptionalText(req.body.status),
          title: normalizeOptionalText(req.body.title),
          description: normalizeOptionalText(req.body.description),
          assigned_agent_id: normalizeOptionalText(req.body.assigned_agent_id),
          due_at: normalizeOptionalText(req.body.due_at),
          payload: req.body.payload || {},
          attrs: req.body.attrs || {}
        };
        const idempotencyKey =
          normalizeOptionalText(req.body?.idempotency_key) ||
          buildIdempotencyKey("crm_task_create", { serviceObjectId, payload });
        const result = await app.coreProcess.advanceInstance(client, {
          tenantId,
          identityId: session.identity_id,
          instanceId: instanceRes.instance.id,
          action: "task.create",
          payload,
          idempotencyKey
        });
        if (!result.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: result.error });
        }

        await client.query("COMMIT");
        return reply.send({ ok: true, created: result.entry?.effects_applied || [], reused: result.reused === true });
      } catch (e) {
        await client.query("ROLLBACK");
        app.log.error({ event: "crm_task_create_error", tenantId, error: e.message });
        return reply.code(500).send({ ok: false });
      } finally {
        client.release();
      }
    }
  );

  // ==========================================================
  // Opportunities
  // ==========================================================
  app.post(
    "/opportunities",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["customer_agent_id"],
          properties: {
            customer_agent_id: { type: "string", minLength: 36, maxLength: 36 },
            title: { type: "string", maxLength: 200 },
            value: {
              type: "object",
              properties: {
                amount: { type: "number" },
                currency: { type: "string", maxLength: 3 }
              }
            },
            probability: { type: "number", minimum: 0, maximum: 1 },
            expected_close_at: { type: "string", maxLength: 40 },
            source: { type: "string", maxLength: 50 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "CRM_OPPORTUNITY_WRITE");
      if (!session) return;

      const tenantId = session.tenant_id;
      const body = req.body || {};
      const customerAgentId = normalizeText(body.customer_agent_id);

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");

        const customer = await ensureAgent(client, tenantId, customerAgentId);
        if (!customer) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "CUSTOMER_NOT_FOUND" });
        }

        const ownerAgentId = await getPrimaryAgentId(client, tenantId, session.identity_id);

        const attrs = {
          value: body.value || {},
          probability: body.probability ?? null,
          expected_close_at: normalizeOptionalText(body.expected_close_at),
          source: normalizeOptionalText(body.source)
        };

        const serviceObject = {
          object_type: "CRM_OPPORTUNITY",
          status: "new",
          title: normalizeOptionalText(body.title) || "Opportunity",
          attrs,
          owner_agent_id: ownerAgentId,
          parties: [
            { role: "CUSTOMER", agent_id: customerAgentId },
            ...(ownerAgentId ? [{ role: "OWNER", agent_id: ownerAgentId }] : [])
          ]
        };

        const processStart = await startProcessFor(client, app, {
          tenantId,
          identityId: session.identity_id,
          objectType: "CRM_OPPORTUNITY",
          serviceObject,
          requireBinding: true
        });
        if (!processStart.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: processStart.error });
        }

        await client.query("COMMIT");
        return reply.send({ ok: true, item: processStart.service_object });
      } catch (e) {
        await client.query("ROLLBACK");
        app.log.error({ event: "crm_opportunity_create_error", tenantId, error: e.message });
        return reply.code(500).send({ ok: false });
      } finally {
        client.release();
      }
    }
  );

  app.get(
    "/opportunities",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            status: { type: "string", maxLength: 50 },
            agent_id: { type: "string", minLength: 36, maxLength: 36 },
            limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "CRM_OPPORTUNITY_READ");
      if (!session) return;

      const tenantId = session.tenant_id;
      const status = normalizeOptionalText(req.query?.status);
      const agentId = normalizeOptionalText(req.query?.agent_id);
      const limit = clampLimit(req.query?.limit);
      const offset = Number(req.query?.offset || 0);

      const params = [tenantId];
      const filters = [
        "so.tenant_id = $1",
        "so.object_type = 'CRM_OPPORTUNITY'"
      ];

      if (status) {
        params.push(normalizeStatus(status));
        filters.push(`so.status = $${params.length}`);
      }
      if (agentId) {
        params.push(agentId);
        filters.push(
          `EXISTS (
            SELECT 1
            FROM eip_core.service_object_party sop
            WHERE sop.tenant_id = so.tenant_id
              AND sop.service_object_id = so.id
              AND sop.role = 'CUSTOMER'
              AND sop.agent_id = $${params.length}
          )`
        );
      }

      params.push(limit);
      params.push(offset);

      const r = await app.db.query(
        `
        SELECT so.id, so.status, so.title, so.attrs, so.owner_agent_id, so.created_at, so.updated_at
        FROM eip_core.service_object so
        WHERE ${filters.join(" AND ")}
        ORDER BY so.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
        `,
        params
      );

      return reply.send({ ok: true, items: r.rows, limit, offset });
    }
  );

  app.get(
    "/opportunities/:id",
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
      const session = await requirePerm(app, req, reply, "CRM_OPPORTUNITY_READ");
      if (!session) return;

      const r = await app.db.query(
        `
        SELECT id, status, title, attrs, owner_agent_id, created_at, updated_at
        FROM eip_core.service_object
        WHERE tenant_id=$1 AND id=$2 AND object_type='CRM_OPPORTUNITY'
        `,
        [session.tenant_id, req.params.id]
      );
      if (r.rowCount === 0) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
      return reply.send({ ok: true, item: r.rows[0] });
    }
  );

  app.post(
    "/opportunities/:id/status",
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
          required: ["to_status"],
          properties: {
            to_status: { type: "string", minLength: 1, maxLength: 50 },
            reason_code: { type: "string", maxLength: 50 },
            note: { type: "string", maxLength: 500 },
            idempotency_key: { type: "string", maxLength: 200 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "CRM_OPPORTUNITY_WRITE");
      if (!session) return;

      const toStatus = normalizeStatus(req.body?.to_status);
      const reasonCode = normalizeOptionalText(req.body?.reason_code);
      const note = normalizeOptionalText(req.body?.note);
      const idempotencyKey =
        normalizeOptionalText(req.body?.idempotency_key) ||
        buildIdempotencyKey("crm_opportunity_status", { toStatus, reasonCode, note });

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");

        const soRes = await client.query(
          `
          SELECT id
          FROM eip_core.service_object
          WHERE tenant_id=$1 AND id=$2 AND object_type='CRM_OPPORTUNITY'
          `,
          [session.tenant_id, req.params.id]
        );
        if (soRes.rowCount === 0) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "NOT_FOUND" });
        }

        const instanceRes = await ensureProcessInstance(client, app, {
          tenantId: session.tenant_id,
          identityId: session.identity_id,
          serviceObjectId: req.params.id,
          objectType: "CRM_OPPORTUNITY"
        });
        if (!instanceRes.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: instanceRes.error });
        }

        const result = await app.coreProcess.advanceInstance(client, {
          tenantId: session.tenant_id,
          identityId: session.identity_id,
          instanceId: instanceRes.instance.id,
          action: toStatus,
          payload: { to_status: toStatus, reason_code: reasonCode, note },
          idempotencyKey
        });
        if (!result.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: result.error });
        }

        await client.query("COMMIT");
        return reply.send({ ok: true, reused: result.reused === true });
      } catch (e) {
        await client.query("ROLLBACK");
        app.log.error({ event: "crm_opportunity_status_error", tenantId: session.tenant_id, error: e.message });
        return reply.code(500).send({ ok: false });
      } finally {
        client.release();
      }
    }
  );

  app.post(
    "/opportunities/:id/tasks",
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
          required: ["task_type"],
          properties: {
            task_type: { type: "string", minLength: 2, maxLength: 50 },
            status: { type: "string", maxLength: 50 },
            title: { type: "string", maxLength: 200 },
            description: { type: "string", maxLength: 2000 },
            assigned_agent_id: { type: "string", minLength: 36, maxLength: 36 },
            due_at: { type: "string", maxLength: 40 },
            payload: { type: "object" },
            attrs: { type: "object" },
            idempotency_key: { type: "string", maxLength: 200 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "CRM_TASK_WRITE");
      if (!session) return;

      const tenantId = session.tenant_id;
      const serviceObjectId = req.params.id;

      const soRes = await app.db.query(
        `
        SELECT id
        FROM eip_core.service_object
        WHERE tenant_id=$1 AND id=$2 AND object_type='CRM_OPPORTUNITY'
        `,
        [tenantId, serviceObjectId]
      );
      if (soRes.rowCount === 0) return reply.code(404).send({ ok: false, error: "NOT_FOUND" });

      if (req.body?.assigned_agent_id) {
        const agent = await ensureAgent(app.db, tenantId, req.body.assigned_agent_id);
        if (!agent) return reply.code(404).send({ ok: false, error: "ASSIGNEE_NOT_FOUND" });
      }

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");

        const instanceRes = await ensureProcessInstance(client, app, {
          tenantId,
          identityId: session.identity_id,
          serviceObjectId,
          objectType: "CRM_OPPORTUNITY"
        });
        if (!instanceRes.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: instanceRes.error });
        }

        const payload = {
          task_type: normalizeText(req.body.task_type),
          status: normalizeOptionalText(req.body.status),
          title: normalizeOptionalText(req.body.title),
          description: normalizeOptionalText(req.body.description),
          assigned_agent_id: normalizeOptionalText(req.body.assigned_agent_id),
          due_at: normalizeOptionalText(req.body.due_at),
          payload: req.body.payload || {},
          attrs: req.body.attrs || {}
        };

        const idempotencyKey =
          normalizeOptionalText(req.body?.idempotency_key) ||
          buildIdempotencyKey("crm_task_create", { serviceObjectId, payload });

        const result = await app.coreProcess.advanceInstance(client, {
          tenantId,
          identityId: session.identity_id,
          instanceId: instanceRes.instance.id,
          action: "task.create",
          payload,
          idempotencyKey
        });
        if (!result.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: result.error });
        }

        await client.query("COMMIT");
        const created = (result.entry?.effects_applied || []).filter(
          (effect) => effect.type === "TASK_CREATE"
        );
        return reply.send({ ok: true, created, reused: result.reused === true });
      } catch (e) {
        await client.query("ROLLBACK");
        app.log.error({ event: "crm_task_create_error", tenantId, error: e.message });
        return reply.code(500).send({ ok: false });
      } finally {
        client.release();
      }
    }
  );

  // ==========================================================
  // Tasks
  // ==========================================================
  app.get(
    "/tasks",
    {
      schema: {
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            status: { type: "string", maxLength: 50 },
            assigned_agent_id: { type: "string", minLength: 36, maxLength: 36 },
            service_object_id: { type: "string", minLength: 36, maxLength: 36 },
            limit: { type: "integer", minimum: 1, maximum: MAX_LIMIT, default: 50 },
            offset: { type: "integer", minimum: 0, default: 0 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "CRM_TASK_READ");
      if (!session) return;

      const tenantId = session.tenant_id;
      const status = normalizeOptionalText(req.query?.status);
      const assignedAgentId = normalizeOptionalText(req.query?.assigned_agent_id);
      const serviceObjectId = normalizeOptionalText(req.query?.service_object_id);
      const limit = clampLimit(req.query?.limit);
      const offset = Number(req.query?.offset || 0);

      const params = [tenantId];
      const filters = ["tenant_id = $1"];

      if (status) {
        params.push(normalizeStatus(status));
        filters.push(`status = $${params.length}`);
      }
      if (assignedAgentId) {
        params.push(assignedAgentId);
        filters.push(`assigned_agent_id = $${params.length}`);
      }
      if (serviceObjectId) {
        params.push(serviceObjectId);
        filters.push(`service_object_id = $${params.length}`);
      }

      params.push(limit);
      params.push(offset);

      const r = await app.db.query(
        `
        SELECT id, service_object_id, task_type, status, title, description,
               assigned_agent_id, due_at, payload, attrs, created_at, updated_at
        FROM eip_core.task
        WHERE ${filters.join(" AND ")}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}
        `,
        params
      );

      return reply.send({ ok: true, items: r.rows, limit, offset });
    }
  );

  app.post(
    "/tasks",
    {
      schema: {
        body: {
          type: "object",
          additionalProperties: false,
          required: ["service_object_id", "task_type"],
          properties: {
            service_object_id: { type: "string", minLength: 36, maxLength: 36 },
            task_type: { type: "string", minLength: 2, maxLength: 50 },
            status: { type: "string", maxLength: 50 },
            title: { type: "string", maxLength: 200 },
            description: { type: "string", maxLength: 2000 },
            assigned_agent_id: { type: "string", minLength: 36, maxLength: 36 },
            due_at: { type: "string", maxLength: 40 },
            payload: { type: "object" },
            attrs: { type: "object" },
            idempotency_key: { type: "string", maxLength: 200 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "CRM_TASK_WRITE");
      if (!session) return;

      const tenantId = session.tenant_id;
      const serviceObjectId = normalizeText(req.body.service_object_id);

      const soRes = await app.db.query(
        `
        SELECT id, object_type
        FROM eip_core.service_object
        WHERE tenant_id=$1 AND id=$2
        `,
        [tenantId, serviceObjectId]
      );
      if (soRes.rowCount === 0) return reply.code(404).send({ ok: false, error: "SERVICE_OBJECT_NOT_FOUND" });

      if (req.body?.assigned_agent_id) {
        const agent = await ensureAgent(app.db, tenantId, req.body.assigned_agent_id);
        if (!agent) return reply.code(404).send({ ok: false, error: "ASSIGNEE_NOT_FOUND" });
      }

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");

        const instanceRes = await ensureProcessInstance(client, app, {
          tenantId,
          identityId: session.identity_id,
          serviceObjectId,
          objectType: soRes.rows[0].object_type
        });
        if (!instanceRes.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: instanceRes.error });
        }

        const payload = {
          task_type: normalizeText(req.body.task_type),
          status: normalizeOptionalText(req.body.status),
          title: normalizeOptionalText(req.body.title),
          description: normalizeOptionalText(req.body.description),
          assigned_agent_id: normalizeOptionalText(req.body.assigned_agent_id),
          due_at: normalizeOptionalText(req.body.due_at),
          payload: req.body.payload || {},
          attrs: req.body.attrs || {}
        };

        const idempotencyKey =
          normalizeOptionalText(req.body?.idempotency_key) ||
          buildIdempotencyKey("crm_task_create", { serviceObjectId, payload });

        const result = await app.coreProcess.advanceInstance(client, {
          tenantId,
          identityId: session.identity_id,
          instanceId: instanceRes.instance.id,
          action: "task.create",
          payload,
          idempotencyKey
        });
        if (!result.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: result.error });
        }

        await client.query("COMMIT");
        const created = (result.entry?.effects_applied || []).filter(
          (effect) => effect.type === "TASK_CREATE"
        );
        return reply.send({ ok: true, created, reused: result.reused === true });
      } catch (e) {
        await client.query("ROLLBACK");
        app.log.error({ event: "crm_task_create_error", tenantId, error: e.message });
        return reply.code(500).send({ ok: false });
      } finally {
        client.release();
      }
    }
  );

  app.post(
    "/tasks/:id/status",
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
          required: ["to_status"],
          properties: {
            to_status: { type: "string", minLength: 1, maxLength: 50 },
            reason_code: { type: "string", maxLength: 50 },
            note: { type: "string", maxLength: 500 },
            idempotency_key: { type: "string", maxLength: 200 }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "CRM_TASK_WRITE");
      if (!session) return;

      const tenantId = session.tenant_id;
      const toStatus = normalizeStatus(req.body?.to_status);
      const reasonCode = normalizeOptionalText(req.body?.reason_code);
      const note = normalizeOptionalText(req.body?.note);

      const client = await app.db.connect();
      try {
        await client.query("BEGIN");

        const taskRes = await client.query(
          `
          SELECT service_object_id
          FROM eip_core.task
          WHERE tenant_id=$1 AND id=$2
          `,
          [tenantId, req.params.id]
        );
        if (taskRes.rowCount === 0) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "TASK_NOT_FOUND" });
        }

        const serviceObjectId = taskRes.rows[0].service_object_id;
        const soRes = await client.query(
          `
          SELECT object_type
          FROM eip_core.service_object
          WHERE tenant_id=$1 AND id=$2
          `,
          [tenantId, serviceObjectId]
        );
        if (soRes.rowCount === 0) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "SERVICE_OBJECT_NOT_FOUND" });
        }

        const instanceRes = await ensureProcessInstance(client, app, {
          tenantId,
          identityId: session.identity_id,
          serviceObjectId,
          objectType: soRes.rows[0].object_type
        });
        if (!instanceRes.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: instanceRes.error });
        }

        const payload = {
          task_id: req.params.id,
          to_status: toStatus,
          reason_code: reasonCode,
          note
        };
        const idempotencyKey =
          normalizeOptionalText(req.body?.idempotency_key) ||
          buildIdempotencyKey("crm_task_status", payload);

        const result = await app.coreProcess.advanceInstance(client, {
          tenantId,
          identityId: session.identity_id,
          instanceId: instanceRes.instance.id,
          action: "task.status",
          payload,
          idempotencyKey
        });
        if (!result.ok) {
          await client.query("ROLLBACK");
          return reply.code(409).send({ ok: false, error: result.error });
        }

        await client.query("COMMIT");
        return reply.send({ ok: true, reused: result.reused === true });
      } catch (e) {
        await client.query("ROLLBACK");
        app.log.error({ event: "crm_task_status_error", tenantId, error: e.message });
        return reply.code(500).send({ ok: false });
      } finally {
        client.release();
      }
    }
  );

  // ==========================================================
  // Segment notes (info_record)
  // ==========================================================
  app.post(
    "/segments/:id/notes",
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
          required: ["title"],
          properties: {
            title: { type: "string", minLength: 2, maxLength: 200 },
            description: { type: "string", maxLength: 2000 },
            payload: { type: "object" },
            attrs: { type: "object" }
          }
        }
      }
    },
    async (req, reply) => {
      const session = await requirePerm(app, req, reply, "CRM_AGENT_WRITE");
      if (!session) return;

      const tenantId = session.tenant_id;
      const client = await app.db.connect();
      try {
        await client.query("BEGIN");

        const segment = await ensureAgent(client, tenantId, req.params.id);
        if (!segment || !["SEGMENT", "MARKET_GROUP"].includes(String(segment.agent_type || "").toUpperCase())) {
          await client.query("ROLLBACK");
          return reply.code(404).send({ ok: false, error: "SEGMENT_NOT_FOUND" });
        }

        const actorAgentId = await getPrimaryAgentId(client, tenantId, session.identity_id);

        const noteRes = await client.query(
          `
          INSERT INTO eip_core.info_record
            (tenant_id, record_type, title, description, payload, attrs, created_by_agent_id)
          VALUES
            ($1,'CRM_SEGMENT_NOTE',$2,$3,$4::jsonb,$5::jsonb,$6)
          RETURNING id, record_type, title, description, payload, attrs, created_at
          `,
          [
            tenantId,
            normalizeText(req.body.title),
            normalizeOptionalText(req.body.description),
            JSON.stringify(req.body.payload || {}),
            JSON.stringify(req.body.attrs || {}),
            actorAgentId
          ]
        );

        await client.query(
          `
          INSERT INTO eip_core.object_link
            (tenant_id, src_kind, src_id, dst_kind, dst_id, relation_type, attrs)
          VALUES
            ($1,'agent',$2,'info_record',$3,'NOTE','{}'::jsonb)
          ON CONFLICT DO NOTHING
          `,
          [tenantId, req.params.id, noteRes.rows[0].id]
        );

        await client.query("COMMIT");
        return reply.send({ ok: true, item: noteRes.rows[0] });
      } catch (e) {
        await client.query("ROLLBACK");
        app.log.error({ event: "crm_segment_note_error", tenantId, error: e.message });
        return reply.code(500).send({ ok: false });
      } finally {
        client.release();
      }
    }
  );

  // ==========================================================
  // Dashboard
  // ==========================================================
  app.get("/dashboard/summary", async (req, reply) => {
    const session = await requirePerm(app, req, reply, "CRM_DASHBOARD_READ");
    if (!session) return;

    const tenantId = session.tenant_id;
    const opportunityCounts = await app.db.query(
      `
      SELECT status, count(*)::int AS count
      FROM eip_core.service_object
      WHERE tenant_id=$1 AND object_type='CRM_OPPORTUNITY'
      GROUP BY status
      `,
      [tenantId]
    );

    const caseCounts = await app.db.query(
      `
      SELECT status, count(*)::int AS count
      FROM eip_core.service_object
      WHERE tenant_id=$1 AND object_type='CRM_CASE'
      GROUP BY status
      `,
      [tenantId]
    );

    const interactionCounts = await app.db.query(
      `
      SELECT COALESCE(attrs->>'channel','UNKNOWN') AS channel, count(*)::int AS count
      FROM eip_core.service_object
      WHERE tenant_id=$1
        AND object_type='CRM_INTERACTION'
        AND created_at >= now() - interval '30 days'
      GROUP BY COALESCE(attrs->>'channel','UNKNOWN')
      `,
      [tenantId]
    );

    const taskCounts = await app.db.query(
      `
      SELECT
        count(*) FILTER (WHERE status NOT IN ('done','cancelled'))::int AS open,
        count(*) FILTER (WHERE status NOT IN ('done','cancelled') AND due_at IS NOT NULL AND due_at < now())::int AS overdue
      FROM eip_core.task
      WHERE tenant_id=$1
      `,
      [tenantId]
    );

    return reply.send({
      ok: true,
      opportunities: opportunityCounts.rows,
      cases: caseCounts.rows,
      interactions: interactionCounts.rows,
      tasks: taskCounts.rows[0] || { open: 0, overdue: 0 }
    });
  });

  await registerCrmCompletionRoutes(app);
  await registerCrmIntelligenceRoutes(app);
  await registerCrmIntakeRoutes(app);
  await registerCrmMailboxRoutes(app);
}
