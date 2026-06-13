import { hasPermission } from "../auth/perm.js";
import {
  ENTITY_PERMISSIONS,
  EntityInputError,
  createEntity,
  createEntityAddress,
  createEntityBankAccount,
  createEntityContact,
  createEntityRelationship,
  getEntityActivitySummary,
  getEntityDetail,
  getEntityGovernanceOptions,
  getEntityPolicySummary,
  listEntities,
  listEntityAddresses,
  listEntityBankAccounts,
  listEntityContacts,
  listEntityDocuments,
  listEntityRelationships,
  updateEntity,
  updateEntityAddress,
  updateEntityBankAccount,
  updateEntityContact,
  updateEntityRelationship
} from "../services/entities/entityManagement.js";

async function requireEntityPermission(app, req, reply, permissionCode) {
  const sessionResult = await app.requireSession(req, { realm: "EIP" });
  if (!sessionResult.ok) {
    reply.code(sessionResult.status).send({ ok: false, error: sessionResult.error });
    return null;
  }

  if (!["GET", "HEAD"].includes(String(req.method || "").toUpperCase())) {
    const csrfResult = await app.requireCsrf(req);
    if (!csrfResult.ok) {
      reply.code(csrfResult.status).send({ ok: false, error: csrfResult.error });
      return null;
    }
  }

  const allowed = await hasPermission(
    app,
    sessionResult.session.tenant_id,
    sessionResult.session.identity_id,
    permissionCode
  );
  if (!allowed) {
    reply.code(403).send({ ok: false, error: "FORBIDDEN" });
    return null;
  }

  return sessionResult.session;
}

function handleEntityError(reply, error) {
  if (error instanceof EntityInputError) {
    return reply.code(400).send({ ok: false, error: error.code, details: error.details || undefined });
  }
  throw error;
}

export default async function entitiesRoutes(app) {
  app.get("/", async (req, reply) => {
    const session = await requireEntityPermission(app, req, reply, ENTITY_PERMISSIONS.read);
    if (!session) return;
    try {
      return reply.send(await listEntities(app, session, req.query || {}));
    } catch (error) {
      return handleEntityError(reply, error);
    }
  });

  app.post("/", async (req, reply) => {
    const session = await requireEntityPermission(app, req, reply, ENTITY_PERMISSIONS.create);
    if (!session) return;
    try {
      return reply.send(await createEntity(app, session, req.body || {}));
    } catch (error) {
      return handleEntityError(reply, error);
    }
  });

  app.get("/governance/options", async (req, reply) => {
    const session = await requireEntityPermission(app, req, reply, ENTITY_PERMISSIONS.read);
    if (!session) return;
    const options = await getEntityGovernanceOptions(app, session);
    const permissions = [];
    for (const permissionCode of Object.values(ENTITY_PERMISSIONS)) {
      if (await hasPermission(app, session.tenant_id, session.identity_id, permissionCode)) {
        permissions.push(permissionCode);
      }
    }
    return reply.send({ ...options, permissions });
  });

  app.get("/:id", async (req, reply) => {
    const session = await requireEntityPermission(app, req, reply, ENTITY_PERMISSIONS.read);
    if (!session) return;
    try {
      const result = await getEntityDetail(app, session, req.params.id);
      if (!result) return reply.code(404).send({ ok: false, error: "ENTITY_NOT_FOUND" });
      return reply.send(result);
    } catch (error) {
      return handleEntityError(reply, error);
    }
  });

  app.patch("/:id", async (req, reply) => {
    const session = await requireEntityPermission(app, req, reply, ENTITY_PERMISSIONS.update);
    if (!session) return;
    try {
      const result = await updateEntity(app, session, req.params.id, req.body || {});
      if (!result) return reply.code(404).send({ ok: false, error: "ENTITY_NOT_FOUND" });
      return reply.send(result);
    } catch (error) {
      return handleEntityError(reply, error);
    }
  });

  app.get("/:id/summary", async (req, reply) => {
    const session = await requireEntityPermission(app, req, reply, ENTITY_PERMISSIONS.read);
    if (!session) return;
    try {
      const detail = await getEntityDetail(app, session, req.params.id);
      if (!detail) return reply.code(404).send({ ok: false, error: "ENTITY_NOT_FOUND" });
      return reply.send({
        ok: true,
        item: detail.item,
        summary: detail.summary,
        policy_summary: detail.policy_summary,
        activity_summary: detail.activity_summary
      });
    } catch (error) {
      return handleEntityError(reply, error);
    }
  });

  app.get("/:id/addresses", async (req, reply) => {
    const session = await requireEntityPermission(app, req, reply, ENTITY_PERMISSIONS.read);
    if (!session) return;
    try {
      const result = await listEntityAddresses(app, session, req.params.id);
      if (!result.ok) return reply.code(404).send({ ok: false, error: "ENTITY_NOT_FOUND" });
      return reply.send(result);
    } catch (error) {
      return handleEntityError(reply, error);
    }
  });

  app.post("/:id/addresses", async (req, reply) => {
    const session = await requireEntityPermission(app, req, reply, ENTITY_PERMISSIONS.manageAddresses);
    if (!session) return;
    try {
      const result = await createEntityAddress(app, session, req.params.id, req.body || {});
      if (!result) return reply.code(404).send({ ok: false, error: "ENTITY_NOT_FOUND" });
      return reply.send(result);
    } catch (error) {
      return handleEntityError(reply, error);
    }
  });

  app.patch("/:id/addresses/:addressId", async (req, reply) => {
    const session = await requireEntityPermission(app, req, reply, ENTITY_PERMISSIONS.manageAddresses);
    if (!session) return;
    try {
      const result = await updateEntityAddress(app, session, req.params.id, req.params.addressId, req.body || {});
      if (!result) return reply.code(404).send({ ok: false, error: "ADDRESS_NOT_FOUND" });
      return reply.send(result);
    } catch (error) {
      return handleEntityError(reply, error);
    }
  });

  app.get("/:id/contacts", async (req, reply) => {
    const session = await requireEntityPermission(app, req, reply, ENTITY_PERMISSIONS.read);
    if (!session) return;
    try {
      const result = await listEntityContacts(app, session, req.params.id);
      if (!result.ok) return reply.code(404).send({ ok: false, error: "ENTITY_NOT_FOUND" });
      return reply.send(result);
    } catch (error) {
      return handleEntityError(reply, error);
    }
  });

  app.post("/:id/contacts", async (req, reply) => {
    const session = await requireEntityPermission(app, req, reply, ENTITY_PERMISSIONS.manageContacts);
    if (!session) return;
    try {
      const result = await createEntityContact(app, session, req.params.id, req.body || {});
      if (!result) return reply.code(404).send({ ok: false, error: "ENTITY_NOT_FOUND" });
      return reply.send(result);
    } catch (error) {
      return handleEntityError(reply, error);
    }
  });

  app.patch("/:id/contacts/:contactId", async (req, reply) => {
    const session = await requireEntityPermission(app, req, reply, ENTITY_PERMISSIONS.manageContacts);
    if (!session) return;
    try {
      const result = await updateEntityContact(app, session, req.params.id, req.params.contactId, req.body || {});
      if (!result) return reply.code(404).send({ ok: false, error: "CONTACT_NOT_FOUND" });
      return reply.send(result);
    } catch (error) {
      return handleEntityError(reply, error);
    }
  });

  app.get("/:id/bank-accounts", async (req, reply) => {
    const session = await requireEntityPermission(app, req, reply, ENTITY_PERMISSIONS.read);
    if (!session) return;
    try {
      const result = await listEntityBankAccounts(app, session, req.params.id);
      if (!result.ok) return reply.code(404).send({ ok: false, error: "ENTITY_NOT_FOUND" });
      return reply.send(result);
    } catch (error) {
      return handleEntityError(reply, error);
    }
  });

  app.post("/:id/bank-accounts", async (req, reply) => {
    const session = await requireEntityPermission(app, req, reply, ENTITY_PERMISSIONS.manageBankAccounts);
    if (!session) return;
    try {
      const result = await createEntityBankAccount(app, session, req.params.id, req.body || {});
      if (!result) return reply.code(404).send({ ok: false, error: "ENTITY_NOT_FOUND" });
      return reply.send(result);
    } catch (error) {
      return handleEntityError(reply, error);
    }
  });

  app.patch("/:id/bank-accounts/:bankAccountId", async (req, reply) => {
    const session = await requireEntityPermission(app, req, reply, ENTITY_PERMISSIONS.manageBankAccounts);
    if (!session) return;
    try {
      const result = await updateEntityBankAccount(app, session, req.params.id, req.params.bankAccountId, req.body || {});
      if (!result) return reply.code(404).send({ ok: false, error: "BANK_ACCOUNT_NOT_FOUND" });
      return reply.send(result);
    } catch (error) {
      return handleEntityError(reply, error);
    }
  });

  app.get("/:id/relationships", async (req, reply) => {
    const session = await requireEntityPermission(app, req, reply, ENTITY_PERMISSIONS.read);
    if (!session) return;
    try {
      const result = await listEntityRelationships(app, session, req.params.id);
      if (!result.ok) return reply.code(404).send({ ok: false, error: "ENTITY_NOT_FOUND" });
      return reply.send(result);
    } catch (error) {
      return handleEntityError(reply, error);
    }
  });

  app.post("/:id/relationships", async (req, reply) => {
    const session = await requireEntityPermission(app, req, reply, ENTITY_PERMISSIONS.manageRelationships);
    if (!session) return;
    try {
      const result = await createEntityRelationship(app, session, req.params.id, req.body || {});
      if (!result) return reply.code(404).send({ ok: false, error: "ENTITY_NOT_FOUND" });
      return reply.send(result);
    } catch (error) {
      return handleEntityError(reply, error);
    }
  });

  app.patch("/:id/relationships/:relationshipId", async (req, reply) => {
    const session = await requireEntityPermission(app, req, reply, ENTITY_PERMISSIONS.manageRelationships);
    if (!session) return;
    try {
      const result = await updateEntityRelationship(app, session, req.params.id, req.params.relationshipId, req.body || {});
      if (!result) return reply.code(404).send({ ok: false, error: "RELATIONSHIP_NOT_FOUND" });
      return reply.send(result);
    } catch (error) {
      return handleEntityError(reply, error);
    }
  });

  app.get("/:id/documents", async (req, reply) => {
    const session = await requireEntityPermission(app, req, reply, ENTITY_PERMISSIONS.read);
    if (!session) return;
    try {
      const result = await listEntityDocuments(app, session, req.params.id);
      if (!result.ok) return reply.code(404).send({ ok: false, error: "ENTITY_NOT_FOUND" });
      return reply.send(result);
    } catch (error) {
      return handleEntityError(reply, error);
    }
  });

  app.get("/:id/policies", async (req, reply) => {
    const session = await requireEntityPermission(app, req, reply, ENTITY_PERMISSIONS.read);
    if (!session) return;
    try {
      const result = await getEntityPolicySummary(app, session, req.params.id);
      if (!result.ok) return reply.code(404).send({ ok: false, error: "ENTITY_NOT_FOUND" });
      return reply.send(result);
    } catch (error) {
      return handleEntityError(reply, error);
    }
  });

  app.get("/:id/activity", async (req, reply) => {
    const session = await requireEntityPermission(app, req, reply, ENTITY_PERMISSIONS.read);
    if (!session) return;
    try {
      const result = await getEntityActivitySummary(app, session, req.params.id);
      if (!result.ok) return reply.code(404).send({ ok: false, error: "ENTITY_NOT_FOUND" });
      return reply.send(result);
    } catch (error) {
      return handleEntityError(reply, error);
    }
  });
}
