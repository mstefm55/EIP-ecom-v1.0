import { hasPermission } from "../auth/perm.js";
import {
  getPoliciesConditionsOverview,
  getPolicyConditionDetail,
  listPolicyConditions
} from "../services/policiesConditions/readModel.js";

export const POLICIES_CONDITIONS_READ_PERMISSION = "policies_conditions.read";

async function requireRead(app, req, reply) {
  const sessionResult = await app.requireSession(req, { realm: "EIP" });
  if (!sessionResult.ok) {
    reply.code(sessionResult.status).send({ ok: false, error: sessionResult.error });
    return null;
  }

  const allowed = await hasPermission(
    app,
    sessionResult.session.tenant_id,
    sessionResult.session.identity_id,
    POLICIES_CONDITIONS_READ_PERMISSION
  );
  if (!allowed) {
    reply.code(403).send({ ok: false, error: "FORBIDDEN" });
    return null;
  }

  return sessionResult.session;
}

export default async function policiesConditionsRoutes(app) {
  app.get("/", async (req, reply) => {
    const session = await requireRead(app, req, reply);
    if (!session) return;

    try {
      return listPolicyConditions(app, session, req.query || {});
    } catch (error) {
      app.log.error({ event: "policies_conditions_list_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false, error: "POLICIES_CONDITIONS_LIST_FAILED" });
    }
  });

  app.get("/overview", async (req, reply) => {
    const session = await requireRead(app, req, reply);
    if (!session) return;

    try {
      return getPoliciesConditionsOverview(app, session);
    } catch (error) {
      app.log.error({ event: "policies_conditions_overview_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false, error: "POLICIES_CONDITIONS_OVERVIEW_FAILED" });
    }
  });

  app.get("/:id", async (req, reply) => {
    const session = await requireRead(app, req, reply);
    if (!session) return;

    try {
      const result = await getPolicyConditionDetail(app, session, req.params.id);
      if (!result) return reply.code(404).send({ ok: false, error: "POLICY_CONDITION_NOT_FOUND" });
      return result;
    } catch (error) {
      app.log.error({
        event: "policies_conditions_detail_error",
        tenantId: session.tenant_id,
        policyConditionId: req.params.id,
        error: error.message
      });
      return reply.code(500).send({ ok: false, error: "POLICIES_CONDITIONS_DETAIL_FAILED" });
    }
  });
}
