import {
  PERFECT_FIT_SHARED_FIELD_POLICIES
} from "../../lib/perfectFitProductIntegration.js";
import {
  registerPerfectFitProduct,
  syncPerfectFitProduct,
  syncPerfectFitSizeVariants,
  syncPerfectFitVariantPresentation
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

function collectStyleContexts(workspace) {
  const output = [];
  for (const project of workspace?.projects || []) {
    if (project?.nodeType !== "project") continue;
    for (const style of project.children || []) {
      if (style?.nodeType !== "product") continue;
      output.push({
        project,
        style,
        variants: (style.children || []).filter((node) => node?.nodeType === "variant")
      });
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
  "attrs.variant_code",
  "seo.title",
  "seo.description",
  "seo.slug",
  "seo.keywords"
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

function presentationFieldForCanonical(code) {
  if (code === "seo.title") return "seo_title";
  if (code === "seo.description") return "seo_description";
  if (code === "seo.slug") return "seo_slug";
  if (code === "seo.keywords") return "seo_keywords";
  if (code === "taxonomy.tags") return "tags";
  return null;
}

function valueEntryFromContext(context, key) {
  for (const [scope, values] of [
    ["variant", context?.variant?.values],
    ["style", context?.style?.values],
    ["project", context?.project?.values]
  ]) {
    if (values && Object.prototype.hasOwnProperty.call(values, key)) {
      return { found: true, value: values[key], scope };
    }
  }
  return { found: false, value: undefined, scope: null };
}

async function resolveContextValues(db, tenantId, context, fieldResolution) {
  const shared = {};
  const identityMapped = {};
  const presentation = {};
  const presentationPresence = {};
  const applied = [];
  const rejected = [];

  for (const field of fieldResolution.fields || []) {
    if (field.status !== "MAPPED" || !field.canonical_code) continue;
    const entry = valueEntryFromContext(context, field.key);
    if (!entry.found) continue;
    const value = entry.value;

    const presentationField = presentationFieldForCanonical(field.canonical_code);
    if (presentationField) {
      // Variant presentation is owned only by the Style Variant. Do not inherit
      // SEO/tags from Style or Project values by accident.
      if (entry.scope !== "variant") continue;

      if (presentationField === "seo_keywords") {
        const values = Array.isArray(value)
          ? value
          : value === undefined || value === null || value === ""
          ? []
          : [value];
        presentation.seo_keywords = [
          ...new Set(values.map(normalizeText).filter(Boolean))
        ];
        presentationPresence.seo_keywords = true;
      } else if (presentationField === "tags") {
        const values = Array.isArray(value)
          ? value
          : value === undefined || value === null || value === ""
          ? []
          : [value];
        const normalizedTags = [...new Set(values.map(normalizeText).filter(Boolean))];
        let invalid = null;
        if (field.governance_list) {
          for (const tag of normalizedTags) {
            // eslint-disable-next-line no-await-in-loop
            const governed = await validateGovernedDropdownValue(db, {
              tenantId,
              listCode: field.governance_list,
              value: tag
            });
            if (!governed.ok) {
              invalid = { tag, reason: governed.reason };
              break;
            }
          }
        }
        if (invalid) {
          rejected.push({
            key: field.key,
            canonical_code: field.canonical_code,
            reason: invalid.reason,
            governance_list: field.governance_list,
            value: invalid.tag
          });
          continue;
        }
        presentation.tags = normalizedTags;
        presentationPresence.tags = true;
      } else {
        presentation[presentationField] =
          value === undefined || value === null ? "" : normalizeText(value);
        presentationPresence[presentationField] = true;
      }

      applied.push({
        key: field.key,
        canonical_code: field.canonical_code,
        target: `material.attrs.${field.canonical_code}`,
        source: field.mapping_source
      });
      continue;
    }

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

  return {
    shared,
    identityMapped,
    presentation,
    presentationPresence,
    applied,
    rejected
  };
}

function projectCode(project, identityMapped = {}) {
  return (
    identityMapped.project_code ||
    normalizeText(project?.values?.["project.designer_code"]) ||
    null
  );
}

function styleCode(style, identityMapped = {}) {
  return (
    identityMapped.style_code ||
    normalizeText(style?.values?.["product.style_code"]) ||
    null
  );
}

function buildStyleIdentity(context, identityMapped) {
  const { project, style } = context;
  return {
    entity_level: "STYLE",
    pf_product_id: normalizeText(style?.id),
    project_id: normalizeText(project?.id) || null,
    style_id: normalizeText(style?.id) || null,
    variant_id: null,
    project_code: projectCode(project, identityMapped),
    style_code: styleCode(style, identityMapped),
    variant_code: null,
    pattern_references: [],
    workspace_url: null
  };
}

function buildStyleVariantIdentity(context, identityMapped) {
  const { project, style, variant } = context;
  return {
    entity_level: "STYLE_VARIANT",
    pf_product_id: normalizeText(variant?.id),
    project_id: normalizeText(project?.id) || null,
    style_id: normalizeText(style?.id) || null,
    variant_id: normalizeText(variant?.id) || null,
    project_code: projectCode(project, identityMapped),
    style_code: styleCode(style, identityMapped),
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

function styleVariantProductName(style, variant, baseName) {
  const styleName = normalizeText(baseName || style?.values?.["product.style_name"] || style?.title);
  const variantName = normalizeText(variant?.values?.["variant.name"] || variant?.title);
  if (!variantName) return styleName;
  if (!styleName) return variantName;
  return `${styleName} — ${variantName}`;
}

function extractSizeVariants(variant) {
  const measurementNode = (variant?.children || []).find((node) => node?.nodeType === "sizeSet");
  const chart = measurementNode?.values && typeof measurementNode.values === "object"
    ? measurementNode.values
    : {};
  const displaySystem = normalizeText(chart.displaySystem || chart.display_system || "ALPHA").toUpperCase();

  return (Array.isArray(chart.sizes) ? chart.sizes : [])
    .map((size, index) => {
      const references = size?.references && typeof size.references === "object"
        ? size.references
        : {};
      const label = normalizeText(
        references[displaySystem] ||
        size?.label ||
        size?.code ||
        references.ALPHA ||
        size?.id
      );
      const id = normalizeText(size?.id || size?.code || `size-${index + 1}`);
      if (!id || !label) return null;
      return {
        id,
        code: normalizeText(size?.code) || null,
        label,
        size: label,
        references,
        active: size?.active !== false
      };
    })
    .filter(Boolean);
}

async function syncRegisteredProduct(db, {
  tenantId,
  productId,
  actorIdentityId,
  sharedMetadata
}) {
  if (!productId) return null;
  return syncPerfectFitProduct(db, {
    tenantId,
    productId,
    actorIdentityId,
    source: "PERFECT_FIT",
    perfectFitSharedMetadata: sharedMetadata,
    resolutions: {}
  });
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
  let styleMasterCount = 0;
  let styleVariantCount = 0;
  let sizeVariantCount = 0;

  for (const styleContext of collectStyleContexts(workspace)) {
    const styleValues = await resolveContextValues(
      db,
      tenantId,
      { project: styleContext.project, style: styleContext.style, variant: null },
      fieldResolution
    );
    const styleIdentity = buildStyleIdentity(styleContext, styleValues.identityMapped);
    const styleSharedMetadata = policyFilteredSharedMetadata(styleValues.shared);

    if (!styleIdentity.pf_product_id || !styleIdentity.style_id) {
      products.push({
        ok: false,
        entity_level: "STYLE",
        style_id: styleContext?.style?.id || null,
        error: "PERFECT_FIT_STYLE_ID_REQUIRED",
        applied_fields: styleValues.applied,
        rejected_fields: styleValues.rejected
      });
      continue;
    }
    if (!normalizeText(styleSharedMetadata.product_name)) {
      products.push({
        ok: false,
        entity_level: "STYLE",
        style_id: styleIdentity.style_id,
        error: "PRODUCT_NAME_UNMAPPED",
        applied_fields: styleValues.applied,
        rejected_fields: styleValues.rejected
      });
      continue;
    }

    let styleRegistration;
    try {
      styleRegistration = await registerPerfectFitProduct(db, {
        tenantId,
        actorIdentityId,
        perfectFit: styleIdentity,
        sharedMetadata: styleSharedMetadata,
        hierarchy: { level: "STYLE_MASTER" }
      });
    } catch (error) {
      products.push({
        ok: false,
        entity_level: "STYLE",
        style_id: styleIdentity.style_id,
        error: error?.message || String(error),
        applied_fields: styleValues.applied,
        rejected_fields: styleValues.rejected
      });
      continue;
    }

    if (!styleRegistration?.ok) {
      products.push({
        ok: false,
        entity_level: "STYLE",
        style_id: styleIdentity.style_id,
        error: styleRegistration?.error || "STYLE_MASTER_REGISTRATION_FAILED",
        applied_fields: styleValues.applied,
        rejected_fields: styleValues.rejected
      });
      continue;
    }

    const styleProductId = styleRegistration?.item?.id || styleRegistration?.product_id;
    const styleSync = await syncRegisteredProduct(db, {
      tenantId,
      productId: styleProductId,
      actorIdentityId,
      sharedMetadata: styleSharedMetadata
    });
    const styleOk = styleSync ? styleSync.ok !== false : true;
    if (styleOk) styleMasterCount += 1;
    products.push({
      ok: styleOk,
      entity_level: "STYLE",
      style_id: styleIdentity.style_id,
      product_id: styleProductId || null,
      product_level: "STYLE_MASTER",
      reused: styleRegistration?.reused === true,
      applied_fields: styleValues.applied,
      rejected_fields: styleValues.rejected,
      conflicts: styleSync?.conflicts || [],
      unmapped_fields: styleSync?.unmapped_fields || []
    });

    if (!styleOk || !styleProductId) continue;

    for (const variant of styleContext.variants) {
      const variantContext = {
        project: styleContext.project,
        style: styleContext.style,
        variant
      };
      const variantValues = await resolveContextValues(db, tenantId, variantContext, fieldResolution);
      const variantIdentity = buildStyleVariantIdentity(variantContext, variantValues.identityMapped);
      const variantSharedMetadata = policyFilteredSharedMetadata(variantValues.shared);
      variantSharedMetadata.product_name = styleVariantProductName(
        styleContext.style,
        variant,
        variantSharedMetadata.product_name || styleSharedMetadata.product_name
      );

      if (!variantIdentity.pf_product_id || !variantIdentity.variant_id) {
        products.push({
          ok: false,
          entity_level: "STYLE_VARIANT",
          style_id: styleIdentity.style_id,
          variant_id: variant?.id || null,
          error: "PERFECT_FIT_VARIANT_ID_REQUIRED",
          applied_fields: variantValues.applied,
          rejected_fields: variantValues.rejected
        });
        continue;
      }

      try {
        const variantRegistration = await registerPerfectFitProduct(db, {
          tenantId,
          actorIdentityId,
          perfectFit: variantIdentity,
          sharedMetadata: variantSharedMetadata,
          hierarchy: {
            level: "STYLE_VARIANT",
            parent_product_id: styleProductId
          }
        });

        if (!variantRegistration?.ok) {
          products.push({
            ok: false,
            entity_level: "STYLE_VARIANT",
            style_id: styleIdentity.style_id,
            variant_id: variantIdentity.variant_id,
            error: variantRegistration?.error || "STYLE_VARIANT_REGISTRATION_FAILED",
            applied_fields: variantValues.applied,
            rejected_fields: variantValues.rejected
          });
          continue;
        }

        const variantProductId = variantRegistration?.item?.id || variantRegistration?.product_id;
        const variantSync = await syncRegisteredProduct(db, {
          tenantId,
          productId: variantProductId,
          actorIdentityId,
          sharedMetadata: variantSharedMetadata
        });

        let presentationSync = null;
        if (
          variantProductId &&
          Object.keys(variantValues.presentationPresence || {}).length
        ) {
          presentationSync = await syncPerfectFitVariantPresentation(db, {
            tenantId,
            productId: variantProductId,
            presentation: variantValues.presentation,
            presence: variantValues.presentationPresence
          });
        }

        let sizeSync = null;
        const sizes = extractSizeVariants(variant);
        if (variantProductId && sizes.length) {
          sizeSync = await syncPerfectFitSizeVariants(db, {
            tenantId,
            productId: variantProductId,
            sizeVariants: sizes
          });
        }

        const variantOk =
          (variantSync ? variantSync.ok !== false : true) &&
          (presentationSync ? presentationSync.ok !== false : true) &&
          (sizeSync ? sizeSync.ok !== false : true);
        if (variantOk) {
          styleVariantCount += 1;
          sizeVariantCount += Number(sizeSync?.synced_size_count || 0);
        }

        products.push({
          ok: variantOk,
          entity_level: "STYLE_VARIANT",
          style_id: styleIdentity.style_id,
          variant_id: variantIdentity.variant_id,
          product_id: variantProductId || null,
          parent_product_id: styleProductId,
          product_level: "STYLE_VARIANT",
          relation_type: "STYLE_VARIANT_OF",
          reused: variantRegistration?.reused === true,
          size_variant_count: Number(sizeSync?.synced_size_count || 0),
          applied_fields: variantValues.applied,
          rejected_fields: variantValues.rejected,
          conflicts: variantSync?.conflicts || [],
          unmapped_fields: variantSync?.unmapped_fields || [],
          presentation_sync: presentationSync,
          size_sync: sizeSync
        });
      } catch (error) {
        products.push({
          ok: false,
          entity_level: "STYLE_VARIANT",
          style_id: styleIdentity.style_id,
          variant_id: variantIdentity.variant_id,
          error: error?.message || String(error),
          applied_fields: variantValues.applied,
          rejected_fields: variantValues.rejected
        });
      }
    }
  }

  const failures = products.filter((item) => item.ok !== true);
  return {
    ok: failures.length === 0,
    field_resolution: fieldResolution,
    projected_count: products.length - failures.length,
    failed_count: failures.length,
    hierarchy: {
      style_master_count: styleMasterCount,
      style_variant_count: styleVariantCount,
      size_variant_count: sizeVariantCount
    },
    products
  };
}
