import { hasPermission } from "../auth/perm.js";
import { loadModuleWorkspace } from "../services/moduleWorkspace.js";
import {
  getPoliciesConditionsOverview,
  getPolicyConditionTaxonomy,
  getPolicyConditionDetail,
  listPolicyConditions
} from "../services/policiesConditions/readModel.js";
import {
  EffectivePolicyInputError,
  normalizeEffectivePolicyQuery,
  resolveEffectivePolicy
} from "../services/policiesConditions/effectivePolicy.js";

export const POLICIES_CONDITIONS_READ_PERMISSION = "policies_conditions.read";
export const POLICIES_CONDITIONS_READ_EFFECTIVE_PERMISSION = "policies_conditions.read_effective";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requirePermission(app, req, reply, permissionCode) {
  const sessionResult = await app.requireSession(req, { realm: "EIP" });
  if (!sessionResult.ok) {
    reply.code(sessionResult.status).send({ ok: false, error: sessionResult.error });
    return null;
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

async function requireRead(app, req, reply) {
  return requirePermission(app, req, reply, POLICIES_CONDITIONS_READ_PERMISSION);
}

async function requireEffectiveRead(app, req, reply) {
  return requirePermission(app, req, reply, POLICIES_CONDITIONS_READ_EFFECTIVE_PERMISSION);
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

  app.get("/taxonomy", async (req, reply) => {
    const session = await requireRead(app, req, reply);
    if (!session) return;

    try {
      return getPolicyConditionTaxonomy(app, session);
    } catch (error) {
      app.log.error({ event: "policies_conditions_taxonomy_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false, error: "POLICIES_CONDITIONS_TAXONOMY_FAILED" });
    }
  });

  app.get("/governance/options", async (req, reply) => {
    const session = await requireRead(app, req, reply);
    if (!session) return;

    try {
      const [taxonomy, workspace] = await Promise.all([
        getPolicyConditionTaxonomy(app, session),
        loadModuleWorkspace(app, session.tenant_id, "policies-conditions")
      ]);
      return {
        ok: true,
        options: {
          POLICY_DOMAIN: taxonomy.lists?.domains?.options || [],
          POLICY_FAMILY: taxonomy.lists?.families?.options || [],
          POLICY_CONDITION_TYPE: taxonomy.lists?.condition_types?.options || [],
          POLICY_CONDITION_SUBTYPE: taxonomy.lists?.condition_subtypes?.options || []
        },
        defaults: taxonomy.defaults || {},
        permissions: [POLICIES_CONDITIONS_READ_PERMISSION],
        workspace
      };
    } catch (error) {
      app.log.error({ event: "policies_conditions_governance_options_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false, error: "POLICIES_CONDITIONS_GOVERNANCE_OPTIONS_FAILED" });
    }
  });

  app.get("/effective", async (req, reply) => {
    const session = await requireEffectiveRead(app, req, reply);
    if (!session) return;

    let context;
    try {
      context = normalizeEffectivePolicyQuery(req.query || {});
    } catch (error) {
      if (error instanceof EffectivePolicyInputError) {
        return reply.code(400).send({
          ok: false,
          error: "INVALID_EFFECTIVE_POLICY_CONTEXT",
          details: error.details
        });
      }
      throw error;
    }

    try {
      return resolveEffectivePolicy(app, session, context);
    } catch (error) {
      app.log.error({ event: "policies_conditions_effective_error", tenantId: session.tenant_id, error: error.message });
      return reply.code(500).send({ ok: false, error: "POLICIES_CONDITIONS_EFFECTIVE_FAILED" });
    }
  });

  app.get("/:id", async (req, reply) => {
    const session = await requireRead(app, req, reply);
    if (!session) return;

    if (!UUID_PATTERN.test(String(req.params.id || ""))) {
      return reply.code(400).send({ ok: false, error: "INVALID_POLICY_CONDITION_ID" });
    }

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
