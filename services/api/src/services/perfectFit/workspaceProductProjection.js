import {
  PERFECT_FIT_SHARED_FIELD_POLICIES
} from "../../lib/perfectFitProductIntegration.js";
import {
  registerPerfectFitProduct,
  syncPerfectFitProduct
} from "./productGateway.js";
import {
  resolveSocketFieldAliases,
  validateGovernedDropdownValue
} from "../socket/fieldAliasResolver.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function valueFromContext(context, key) {
  for (const values of [
    context?.variant?.values,
    context?.style?.values,
    context?.project?.values
  ]) {
    if (values && Object.prototype.hasOwnProperty.call(values, key)) {
      return values[key];
    }
  }
  return undefined;
}

function collectVariantContexts(workspace) {
  const output = [];
  for (const project of workspace?.projects || []) {
    if (project?.nodeType !== "project") continue;
    for (const style of project.children || []) {
      if (style?.nodeType !== "product") continue;
      for (const variant of style.children || []) {
        if (variant?.nodeType !== "variant") continue;
        output.push({ project, style, variant });
      }
    }
  }
  return output;
}

const PF_CANONICAL_CODES = Object.freeze([
  "product.name",
  "product.code",
  "product.category",
  "attrs.product_description",
  "attrs.designer_code",
  "attrs.variant_code"
]);

function sharedFieldForCanonical(code) {
  if (code === "product.name") return "product_name";
  if (code === "attrs.product_description") return "description";
  if (code === "product.category") return "category_code";
  return null;
}

function identityFieldForCanonical(code) {
  if (code === "attrs.designer_code") return "project_code";
  if (code === "product.code") return "style_code";
  if (code === "attrs.variant_code") return "variant_code";
  return null;
}

async function resolveContextValues(db, tenantId, context, fieldResolution) {
  const shared = {};
  const identityMapped = {};
  const applied = [];
  const rejected = [];

  for (const field of fieldResolution.fields || []) {
    if (field.status !== "MAPPED" || !field.canonical_code) continue;
    const value = valueFromContext(context, field.key);
    if (value === undefined || value === null || value === "") continue;

    if (field.governance_list) {
      const governed = await validateGovernedDropdownValue(db, {
        tenantId,
        listCode: field.governance_list,
        value
      });
      if (!governed.ok) {
        rejected.push({
          key: field.key,
          canonical_code: field.canonical_code,
          reason: governed.reason,
          governance_list: field.governance_list,
          value
        });
        continue;
      }
    }

    const sharedField = sharedFieldForCanonical(field.canonical_code);
    if (sharedField) {
      shared[sharedField] = normalizeText(value) || null;
      applied.push({
        key: field.key,
        canonical_code: field.canonical_code,
        target: `shared_metadata.${sharedField}`,
        source: field.mapping_source
      });
      continue;
    }

    const identityField = identityFieldForCanonical(field.canonical_code);
    if (identityField) {
      identityMapped[identityField] = normalizeText(value) || null;
      applied.push({
        key: field.key,
        canonical_code: field.canonical_code,
        target: `perfect_fit.${identityField}`,
        source: field.mapping_source
      });
    }
  }

  return { shared, identityMapped, applied, rejected };
}

function buildIdentity(context, identityMapped) {
  const { project, style, variant } = context;
  return {
    pf_product_id: normalizeText(variant?.id),
    project_id: normalizeText(project?.id) || null,
    style_id: normalizeText(style?.id) || null,
    variant_id: normalizeText(variant?.id) || null,
    project_code:
      identityMapped.project_code ||
      normalizeText(project?.values?.["project.designer_code"]) ||
      null,
    style_code:
      identityMapped.style_code ||
      normalizeText(style?.values?.["product.style_code"]) ||
      null,
    variant_code:
      identityMapped.variant_code ||
      normalizeText(variant?.values?.["variant.code"]) ||
      null,
    pattern_references: (variant?.children || [])
      .filter((node) => node?.nodeType === "patternLibrary")
      .flatMap((node) => node?.values?.patterns || [])
      .map((pattern) => normalizeText(pattern?.reference || pattern?.code || pattern?.id))
      .filter(Boolean),
    workspace_url: null
  };
}

function policyFilteredSharedMetadata(shared) {
  const output = {};
  for (const [field, value] of Object.entries(shared || {})) {
    const policy = PERFECT_FIT_SHARED_FIELD_POLICIES[field];
    if (!policy) continue;
    // EIP-owned and derived values are never initiated by a PF Save.
    if (policy === "EIP_WINS" || policy === "DERIVED") continue;
    // Manual-review values require an explicit resolution path, not ordinary Save.
    if (policy === "MANUAL_REVIEW") continue;
    output[field] = value;
  }
  return output;
}

export async function projectPerfectFitWorkspaceProducts(db, {
  tenantId,
  actorIdentityId,
  workspace,
  fieldContract,
  socketCode = null,
  connectionCode = null
}) {
  const fields = Array.isArray(fieldContract?.fields) ? fieldContract.fields : [];
  const fieldResolution = await resolveSocketFieldAliases(db, {
    tenantId,
    fields,
    allowedCanonicalCodes: PF_CANONICAL_CODES,
    socketCode,
    connectionCode
  });

  const products = [];
  for (const context of collectVariantContexts(workspace)) {
    const values = await resolveContextValues(db, tenantId, context, fieldResolution);
    const identity = buildIdentity(context, values.identityMapped);
    const sharedMetadata = policyFilteredSharedMetadata(values.shared);

    if (!identity.pf_product_id || !identity.variant_id) {
      products.push({
        ok: false,
        variant_id: context?.variant?.id || null,
        error: "PERFECT_FIT_STABLE_ID_REQUIRED",
        applied_fields: values.applied,
        rejected_fields: values.rejected
      });
      continue;
    }
    if (!normalizeText(sharedMetadata.product_name)) {
      products.push({
        ok: false,
        variant_id: identity.variant_id,
        error: "PRODUCT_NAME_UNMAPPED",
        applied_fields: values.applied,
        rejected_fields: values.rejected
      });
      continue;
    }

    try {
      const registration = await registerPerfectFitProduct(db, {
        tenantId,
        actorIdentityId,
        perfectFit: identity,
        sharedMetadata
      });
      if (!registration?.ok) {
        products.push({
          ok: false,
          variant_id: identity.variant_id,
          error: registration?.error || "PRODUCT_REGISTRATION_FAILED",
          applied_fields: values.applied,
          rejected_fields: values.rejected
        });
        continue;
      }

      const productId = registration?.item?.id || registration?.product_id;
      let sync = null;
      if (productId) {
        sync = await syncPerfectFitProduct(db, {
          tenantId,
          productId,
          actorIdentityId,
          source: "PERFECT_FIT",
          perfectFitSharedMetadata: sharedMetadata,
          resolutions: {}
        });
      }

      products.push({
        ok: sync ? sync.ok !== false : true,
        variant_id: identity.variant_id,
        product_id: productId || null,
        reused: registration?.reused === true,
        applied_fields: values.applied,
        rejected_fields: values.rejected,
        conflicts: sync?.conflicts || [],
        unmapped_fields: sync?.unmapped_fields || []
      });
    } catch (error) {
      products.push({
        ok: false,
        variant_id: identity.variant_id,
        error: error?.message || String(error),
        applied_fields: values.applied,
        rejected_fields: values.rejected
      });
    }
  }

  const failures = products.filter((item) => item.ok !== true);
  return {
    ok: failures.length === 0,
    field_resolution: fieldResolution,
    projected_count: products.length - failures.length,
    failed_count: failures.length,
    products
  };
}
