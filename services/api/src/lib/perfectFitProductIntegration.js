export const PERFECT_FIT_LINK_RECORD_TYPE = "PERFECT_FIT_PRODUCT_LINK";
export const PERFECT_FIT_LINK_RELATION = "PERFECT_FIT_PRODUCT";

export const PERFECT_FIT_SHARED_FIELD_POLICIES = Object.freeze({
  product_name: "LATEST_ACCEPTED",
  description: "PF_WINS",
  brand: "LATEST_ACCEPTED",
  category_code: "EIP_WINS",
  category_label: "DERIVED",
  lifecycle_status: "EIP_WINS",
  publication_status: "MANUAL_REVIEW",
  currency: "EIP_WINS"
});

const SHARED_FIELDS = Object.freeze(Object.keys(PERFECT_FIT_SHARED_FIELD_POLICIES));

function optionalText(value, maxLength = 5000) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

export function normalizePerfectFitIdentity(input = {}) {
  const identity = {
    pf_product_id: optionalText(input.pf_product_id, 240),
    project_id: optionalText(input.project_id, 240),
    style_id: optionalText(input.style_id, 240),
    variant_id: optionalText(input.variant_id, 240),
    project_code: optionalText(input.project_code, 160),
    style_code: optionalText(input.style_code, 160),
    variant_code: optionalText(input.variant_code, 160),
    pattern_references: Array.isArray(input.pattern_references)
      ? [...new Set(input.pattern_references.map((item) => optionalText(item, 240)).filter(Boolean))].slice(0, 100)
      : [],
    workspace_url: optionalText(input.workspace_url, 2000)
  };
  if (!identity.pf_product_id || !identity.variant_id) {
    return { ok: false, error: "PERFECT_FIT_STABLE_ID_REQUIRED" };
  }
  return { ok: true, identity };
}

export function normalizeSharedMetadata(input = {}) {
  const source = input && typeof input === "object" ? input : {};
  return Object.fromEntries(
    SHARED_FIELDS.map((field) => [field, optionalText(source[field])])
  );
}

export function extractEipSharedMetadata(material = {}) {
  const attrs = material?.attrs && typeof material.attrs === "object" ? material.attrs : {};
  const pricing = Array.isArray(attrs?.pricing?.tiers) ? attrs.pricing.tiers : [];
  return normalizeSharedMetadata({
    product_name: material.title || material.name,
    description: attrs?.content?.summary,
    brand: attrs?.taxonomy?.brand_code || attrs?.taxonomy?.brand,
    category_code: attrs?.taxonomy?.category_code,
    category_label: attrs?.taxonomy?.category_label || attrs?.taxonomy?.category,
    lifecycle_status: attrs?.workflow?.stage,
    publication_status: attrs?.workflow?.publication_status || attrs?.workflow?.stage,
    currency: pricing[0]?.currency || attrs?.pricing?.currency
  });
}

function changed(previous, next) {
  return (previous ?? null) !== (next ?? null);
}

/**
 * Reconcile only the explicitly shared projection. Rich Perfect Fit records never enter this
 * function and therefore cannot be replaced by an EIP material representation.
 */
export function reconcileSharedMetadata({
  source,
  eip = {},
  perfectFit = {},
  lastAccepted = {},
  resolutions = {}
} = {}) {
  const normalizedSource = String(source || "").toUpperCase();
  const eipValues = normalizeSharedMetadata(eip);
  const pfValues = normalizeSharedMetadata(perfectFit);
  const previous = normalizeSharedMetadata(lastAccepted);
  const accepted = { ...previous };
  const conflicts = [];
  const unmapped = Object.keys(perfectFit || {}).filter((key) => !SHARED_FIELDS.includes(key));

  for (const field of SHARED_FIELDS) {
    const policy = PERFECT_FIT_SHARED_FIELD_POLICIES[field];
    const eipValue = eipValues[field];
    const pfValue = pfValues[field];
    const prior = previous[field];
    if (policy === "PF_WINS") {
      accepted[field] = pfValue ?? eipValue ?? prior;
      continue;
    }
    if (policy === "EIP_WINS" || policy === "DERIVED") {
      accepted[field] = eipValue ?? prior;
      continue;
    }
    if (policy === "LATEST_ACCEPTED") {
      accepted[field] = normalizedSource === "PERFECT_FIT"
        ? (pfValue ?? eipValue ?? prior)
        : (eipValue ?? pfValue ?? prior);
      continue;
    }

    const resolution = String(resolutions?.[field] || "").toUpperCase();
    if (resolution === "PF") {
      accepted[field] = pfValue ?? prior;
    } else if (resolution === "EIP") {
      accepted[field] = eipValue ?? prior;
    } else if (eipValue === pfValue) {
      accepted[field] = eipValue;
    } else if (changed(prior, eipValue) && changed(prior, pfValue) && eipValue && pfValue) {
      conflicts.push({ field, policy, eip_value: eipValue, perfect_fit_value: pfValue, last_accepted: prior });
    } else {
      accepted[field] = changed(prior, pfValue) ? pfValue : eipValue;
    }
  }

  return {
    accepted: normalizeSharedMetadata(accepted),
    patch_to_eip: normalizeSharedMetadata(accepted),
    patch_to_perfect_fit: normalizeSharedMetadata(accepted),
    conflicts,
    unmapped_fields: unmapped
  };
}

export function buildPerfectFitLinkPayload({ identity, sharedMetadata, origin, actorIdentityId, existing = {} }) {
  const now = new Date().toISOString();
  return {
    ...existing,
    schema_version: 1,
    origin: String(origin || existing.origin || "LINKED").toUpperCase(),
    perfect_fit: { ...identity },
    shared_snapshot: {
      ...(existing.shared_snapshot || {}),
      accepted: normalizeSharedMetadata(sharedMetadata),
      updated_at: now,
      updated_by_identity_id: actorIdentityId || null
    },
    linked_at: existing.linked_at || now,
    updated_at: now
  };
}
