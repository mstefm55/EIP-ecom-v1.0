from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path, old, new, label):
    p = ROOT / path
    text = p.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one match in {path}, found {count}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"patched {label}: {path}")


# -----------------------------------------------------------------------------
# Server: PF workspace -> Style Variant EIP presentation projection
# -----------------------------------------------------------------------------
projection = "services/api/src/services/perfectFit/workspaceProductProjection.js"
replace_once(
    projection,
    '  registerPerfectFitProduct,\n  syncPerfectFitProduct,\n  syncPerfectFitSizeVariants\n} from "./productGateway.js";',
    '  registerPerfectFitProduct,\n  syncPerfectFitProduct,\n  syncPerfectFitSizeVariants,\n  syncPerfectFitVariantPresentation\n} from "./productGateway.js";',
    "projection import"
)
replace_once(
    projection,
    '  "attrs.product_description",\n  "attrs.designer_code",\n  "attrs.variant_code"\n]);',
    '  "attrs.product_description",\n  "attrs.designer_code",\n  "attrs.variant_code",\n  "seo.title",\n  "seo.description",\n  "seo.slug",\n  "taxonomy.tags"\n]);',
    "projection canonical allowlist"
)
replace_once(
    projection,
    '''function identityFieldForCanonical(code) {\n  if (code === "attrs.designer_code") return "project_code";\n  if (code === "product.code") return "style_code";\n  if (code === "attrs.variant_code") return "variant_code";\n  return null;\n}\n\nasync function resolveContextValues(db, tenantId, context, fieldResolution) {\n  const shared = {};\n  const identityMapped = {};\n  const applied = [];\n  const rejected = [];\n\n  for (const field of fieldResolution.fields || []) {\n    if (field.status !== "MAPPED" || !field.canonical_code) continue;\n    const value = valueFromContext(context, field.key);\n    if (value === undefined || value === null || value === "") continue;\n\n    if (field.governance_list) {\n      const governed = await validateGovernedDropdownValue(db, {\n        tenantId,\n        listCode: field.governance_list,\n        value\n      });\n      if (!governed.ok) {\n        rejected.push({\n          key: field.key,\n          canonical_code: field.canonical_code,\n          reason: governed.reason,\n          governance_list: field.governance_list,\n          value\n        });\n        continue;\n      }\n    }\n\n    const sharedField = sharedFieldForCanonical(field.canonical_code);\n    if (sharedField) {\n      shared[sharedField] = normalizeText(value) || null;\n      applied.push({\n        key: field.key,\n        canonical_code: field.canonical_code,\n        target: `shared_metadata.${sharedField}`,\n        source: field.mapping_source\n      });\n      continue;\n    }\n\n    const identityField = identityFieldForCanonical(field.canonical_code);\n    if (identityField) {\n      identityMapped[identityField] = normalizeText(value) || null;\n      applied.push({\n        key: field.key,\n        canonical_code: field.canonical_code,\n        target: `perfect_fit.${identityField}`,\n        source: field.mapping_source\n      });\n    }\n  }\n\n  return { shared, identityMapped, applied, rejected };\n}\n''',
    '''function identityFieldForCanonical(code) {\n  if (code === "attrs.designer_code") return "project_code";\n  if (code === "product.code") return "style_code";\n  if (code === "attrs.variant_code") return "variant_code";\n  return null;\n}\n\nfunction presentationFieldForCanonical(code) {\n  if (code === "seo.title") return "seo_title";\n  if (code === "seo.description") return "seo_description";\n  if (code === "seo.slug") return "seo_slug";\n  if (code === "taxonomy.tags") return "tags";\n  return null;\n}\n\nfunction valueEntryFromContext(context, key) {\n  for (const [scope, values] of [\n    ["variant", context?.variant?.values],\n    ["style", context?.style?.values],\n    ["project", context?.project?.values]\n  ]) {\n    if (values && Object.prototype.hasOwnProperty.call(values, key)) {\n      return { found: true, value: values[key], scope };\n    }\n  }\n  return { found: false, value: undefined, scope: null };\n}\n\nasync function resolveContextValues(db, tenantId, context, fieldResolution) {\n  const shared = {};\n  const identityMapped = {};\n  const presentation = {};\n  const presentationPresence = {};\n  const applied = [];\n  const rejected = [];\n\n  for (const field of fieldResolution.fields || []) {\n    if (field.status !== "MAPPED" || !field.canonical_code) continue;\n    const entry = valueEntryFromContext(context, field.key);\n    if (!entry.found) continue;\n    const value = entry.value;\n\n    const presentationField = presentationFieldForCanonical(field.canonical_code);\n    if (presentationField) {\n      // Variant presentation is owned only by the Style Variant. Do not inherit\n      // SEO/tags from Style or Project values by accident.\n      if (entry.scope !== "variant") continue;\n\n      if (presentationField === "tags") {\n        const values = Array.isArray(value)\n          ? value\n          : value === undefined || value === null || value === ""\n          ? []\n          : [value];\n        const normalizedTags = [...new Set(values.map(normalizeText).filter(Boolean))];\n        let invalid = null;\n        if (field.governance_list) {\n          for (const tag of normalizedTags) {\n            // eslint-disable-next-line no-await-in-loop\n            const governed = await validateGovernedDropdownValue(db, {\n              tenantId,\n              listCode: field.governance_list,\n              value: tag\n            });\n            if (!governed.ok) {\n              invalid = { tag, reason: governed.reason };\n              break;\n            }\n          }\n        }\n        if (invalid) {\n          rejected.push({\n            key: field.key,\n            canonical_code: field.canonical_code,\n            reason: invalid.reason,\n            governance_list: field.governance_list,\n            value: invalid.tag\n          });\n          continue;\n        }\n        presentation.tags = normalizedTags;\n        presentationPresence.tags = true;\n      } else {\n        presentation[presentationField] =\n          value === undefined || value === null ? "" : normalizeText(value);\n        presentationPresence[presentationField] = true;\n      }\n\n      applied.push({\n        key: field.key,\n        canonical_code: field.canonical_code,\n        target: `material.attrs.${field.canonical_code}`,\n        source: field.mapping_source\n      });\n      continue;\n    }\n\n    if (value === undefined || value === null || value === "") continue;\n\n    if (field.governance_list) {\n      const governed = await validateGovernedDropdownValue(db, {\n        tenantId,\n        listCode: field.governance_list,\n        value\n      });\n      if (!governed.ok) {\n        rejected.push({\n          key: field.key,\n          canonical_code: field.canonical_code,\n          reason: governed.reason,\n          governance_list: field.governance_list,\n          value\n        });\n        continue;\n      }\n    }\n\n    const sharedField = sharedFieldForCanonical(field.canonical_code);\n    if (sharedField) {\n      shared[sharedField] = normalizeText(value) || null;\n      applied.push({\n        key: field.key,\n        canonical_code: field.canonical_code,\n        target: `shared_metadata.${sharedField}`,\n        source: field.mapping_source\n      });\n      continue;\n    }\n\n    const identityField = identityFieldForCanonical(field.canonical_code);\n    if (identityField) {\n      identityMapped[identityField] = normalizeText(value) || null;\n      applied.push({\n        key: field.key,\n        canonical_code: field.canonical_code,\n        target: `perfect_fit.${identityField}`,\n        source: field.mapping_source\n      });\n    }\n  }\n\n  return {\n    shared,\n    identityMapped,\n    presentation,\n    presentationPresence,\n    applied,\n    rejected\n  };\n}\n''',
    "projection presentation resolver"
)
replace_once(
    projection,
    '''        const variantSync = await syncRegisteredProduct(db, {\n          tenantId,\n          productId: variantProductId,\n          actorIdentityId,\n          sharedMetadata: variantSharedMetadata\n        });\n\n        let sizeSync = null;''',
    '''        const variantSync = await syncRegisteredProduct(db, {\n          tenantId,\n          productId: variantProductId,\n          actorIdentityId,\n          sharedMetadata: variantSharedMetadata\n        });\n\n        let presentationSync = null;\n        if (\n          variantProductId &&\n          Object.keys(variantValues.presentationPresence || {}).length\n        ) {\n          presentationSync = await syncPerfectFitVariantPresentation(db, {\n            tenantId,\n            productId: variantProductId,\n            presentation: variantValues.presentation,\n            presence: variantValues.presentationPresence\n          });\n        }\n\n        let sizeSync = null;''',
    "projection presentation sync call"
)
replace_once(
    projection,
    '''        const variantOk =\n          (variantSync ? variantSync.ok !== false : true) &&\n          (sizeSync ? sizeSync.ok !== false : true);''',
    '''        const variantOk =\n          (variantSync ? variantSync.ok !== false : true) &&\n          (presentationSync ? presentationSync.ok !== false : true) &&\n          (sizeSync ? sizeSync.ok !== false : true);''',
    "projection presentation success"
)
replace_once(
    projection,
    '''          conflicts: variantSync?.conflicts || [],\n          unmapped_fields: variantSync?.unmapped_fields || [],\n          size_sync: sizeSync''',
    '''          conflicts: variantSync?.conflicts || [],\n          unmapped_fields: variantSync?.unmapped_fields || [],\n          presentation_sync: presentationSync,\n          size_sync: sizeSync''',
    "projection response presentation"
)

# Product Gateway: merge only explicitly-present PF-owned Variant SEO/tags.
gateway = "services/api/src/services/perfectFit/productGateway.js"
replace_once(
    gateway,
    '''export async function syncPerfectFitProduct(db, {\n  tenantId,''',
    '''export async function syncPerfectFitVariantPresentation(db, {\n  tenantId,\n  productId,\n  presentation = {},\n  presence = {}\n}) {\n  const ownedKeys = ["seo_title", "seo_description", "seo_slug", "tags"];\n  const hasOwnedPatch = ownedKeys.some((key) => presence?.[key] === true);\n  if (!hasOwnedPatch) {\n    return { ok: true, skipped: true, product_id: productId };\n  }\n\n  return withTransaction(db, async (client) => {\n    const material = await client.query(\n      `SELECT id, attrs\n       FROM eip_core.material\n       WHERE tenant_id=$1 AND id=$2 AND material_type=$3\n       FOR UPDATE`,\n      [tenantId, productId, MATERIAL_TYPE]\n    );\n    if (!material.rowCount) return { ok: false, status: 404, error: "NOT_FOUND" };\n\n    const nextAttrs = material.rows[0].attrs && typeof material.rows[0].attrs === "object"\n      ? { ...material.rows[0].attrs }\n      : {};\n\n    if (presence.seo_title || presence.seo_description || presence.seo_slug) {\n      const nextSeo = nextAttrs.seo && typeof nextAttrs.seo === "object"\n        ? { ...nextAttrs.seo }\n        : {};\n      const applySeoValue = (key, value) => {\n        const normalized = String(value ?? "").trim();\n        if (normalized) nextSeo[key] = normalized;\n        else delete nextSeo[key];\n      };\n      if (presence.seo_title) applySeoValue("title", presentation.seo_title);\n      if (presence.seo_description) applySeoValue("description", presentation.seo_description);\n      if (presence.seo_slug) applySeoValue("slug", presentation.seo_slug);\n      if (Object.keys(nextSeo).length) nextAttrs.seo = nextSeo;\n      else delete nextAttrs.seo;\n    }\n\n    if (presence.tags) {\n      nextAttrs.taxonomy = nextAttrs.taxonomy && typeof nextAttrs.taxonomy === "object"\n        ? { ...nextAttrs.taxonomy }\n        : {};\n      nextAttrs.taxonomy.tags = Array.isArray(presentation.tags)\n        ? [...new Set(presentation.tags.map((item) => String(item || "").trim()).filter(Boolean))]\n        : [];\n    }\n\n    nextAttrs.integration = {\n      ...(nextAttrs.integration || {}),\n      perfect_fit: {\n        ...(nextAttrs.integration?.perfect_fit || {}),\n        variant_presentation_synced_at: new Date().toISOString(),\n        variant_presentation_fields: ownedKeys.filter((key) => presence?.[key] === true)\n      }\n    };\n\n    await client.query(\n      `UPDATE eip_core.material SET attrs=$3::jsonb, updated_at=now()\n       WHERE tenant_id=$1 AND id=$2`,\n      [tenantId, productId, JSON.stringify(nextAttrs)]\n    );\n\n    return {\n      ok: true,\n      product_id: productId,\n      updated_fields: ownedKeys.filter((key) => presence?.[key] === true),\n      tags: presence.tags ? nextAttrs.taxonomy?.tags || [] : undefined,\n      seo: nextAttrs.seo || {}\n    };\n  });\n}\n\nexport async function syncPerfectFitProduct(db, {\n  tenantId,''',
    "gateway presentation sync"
)

# -----------------------------------------------------------------------------
# Frontend: governed tag renderer + Variant Overview Discovery & SEO section
# -----------------------------------------------------------------------------
workspace = "apps/samara-web/my-vite-react-app/src/components/Workspace.jsx"
replace_once(
    workspace,
    '''  const label =\n    t(field.labelKey);\n\n  const help =\n    field.helpKey\n      ? t(field.helpKey)\n      : '';''',
    '''  const label =\n    field.label ||\n    (field.labelKey ? t(field.labelKey) : '') ||\n    field.key;\n\n  const help =\n    field.help ||\n    (field.helpKey ? t(field.helpKey) : '');''',
    "workspace field labels"
)
replace_once(
    workspace,
    '''  if (field.type === 'select') {''',
    '''  const optionLabel = (option) =>\n    option?.label ||\n    (option?.labelKey ? t(option.labelKey) : '') ||\n    option?.eipV1Value ||\n    option?.code ||\n    '';\n\n  if (field.type === 'multiselect') {\n    const selected = Array.isArray(value) ? value : [];\n    return (\n      <div className="space-y-2 md:col-span-2">\n        <label className="block text-[10px] font-semibold uppercase tracking-[0.13em] text-bark-500">\n          {label}\n        </label>\n        <div className="flex flex-wrap gap-2 rounded-[9px] border border-[#E5E2DA] bg-[#FCFBF8] p-2.5">\n          {options.map((option) => {\n            const active = selected.includes(option.code);\n            return (\n              <button\n                key={option.code}\n                type="button"\n                disabled={Boolean(field.readOnly)}\n                aria-pressed={active}\n                onClick={() => {\n                  const next = active\n                    ? selected.filter((code) => code !== option.code)\n                    : [...selected, option.code];\n                  onChange(field.key, next);\n                }}\n                className={`rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors ${\n                  active\n                    ? 'border-[#7B5C49] bg-[#7B5C49] text-white'\n                    : 'border-[#D9D5CC] bg-white text-[#4A4741] hover:border-[#BCA892]'\n                } disabled:cursor-not-allowed disabled:opacity-60`}\n              >\n                {optionLabel(option)}\n              </button>\n            );\n          })}\n          {!options.length && (\n            <span className="text-[11px] text-[#918D84]">No governed options available</span>\n          )}\n        </div>\n        {help && (\n          <p className="text-[10px] leading-relaxed text-bark-400">{help}</p>\n        )}\n      </div>\n    );\n  }\n\n  if (field.type === 'select') {''',
    "workspace multiselect"
)
replace_once(
    workspace,
    '''                {t(\n                  option.labelKey\n                )}''',
    '''                {optionLabel(option)}''',
    "workspace select option label"
)
replace_once(
    workspace,
    '''            {group.labelKey && (\n              <div className="border-b border-sand-150 px-5 py-4">\n                <h3 className="font-serif text-lg font-medium text-bark-900">\n                  {t(\n                    group.labelKey\n                  )}\n                </h3>\n              </div>\n            )}''',
    '''            {(group.label || group.labelKey) && (\n              <div className="border-b border-sand-150 px-5 py-4">\n                <h3 className="font-serif text-lg font-medium text-bark-900">\n                  {group.label || t(group.labelKey)}\n                </h3>\n              </div>\n            )}''',
    "workspace group label"
)
replace_once(
    workspace,
    '''      'variant.base_reference_size': values['variant.base_reference_size'] || 'M',\n      'variant.notes': values['variant.notes'] || '',\n      ...values''',
    '''      'variant.base_reference_size': values['variant.base_reference_size'] || 'M',\n      'variant.notes': values['variant.notes'] || '',\n      'variant.seo_title': values['variant.seo_title'] || '',\n      'variant.seo_description': values['variant.seo_description'] || '',\n      'variant.seo_slug': values['variant.seo_slug'] || '',\n      'variant.tags': Array.isArray(values['variant.tags']) ? values['variant.tags'] : [],\n      ...values''',
    "new variant SEO tags defaults"
)
replace_once(
    workspace,
    '''  const primaryAssetSource = primaryAsset?.previewUrl || primaryAsset?.url || overviewImageUrl;\n\n  useEffect(() => {''',
    '''  const primaryAssetSource = primaryAsset?.previewUrl || primaryAsset?.url || overviewImageUrl;\n  const discoverySeoGroup = getFieldGroups(metadata, 'variant').find(\n    (group) => group.key === 'variantDiscoverySeo'\n  );\n\n  useEffect(() => {''',
    "overview discovery group resolver"
)
replace_once(
    workspace,
    '''      </section>\n    </div>\n  );\n}\n\nfunction LegacyOverviewModule({''',
    '''      </section>\n\n      {discoverySeoGroup && (\n        <section className="rounded-[12px] border border-[#E5E2DA] bg-[#FCFBF8]">\n          <div className="border-b border-[#E5E2DA] px-4 py-3">\n            <h3 className="text-[15px] font-semibold text-[#272622]">\n              {discoverySeoGroup.label ||\n                (discoverySeoGroup.labelKey ? t(discoverySeoGroup.labelKey) : 'Discovery & SEO')}\n            </h3>\n          </div>\n          <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">\n            {discoverySeoGroup.fields.map((field) => (\n              <WorkspaceField\n                key={`${variant?.id}-${field.key}`}\n                metadata={metadata}\n                field={field}\n                value={variantValues[field.key]}\n                onChange={handleTargetChange(variant?.id)}\n                t={t}\n              />\n            ))}\n          </div>\n        </section>\n      )}\n    </div>\n  );\n}\n\nfunction LegacyOverviewModule({''',
    "overview discovery SEO section"
)

# -----------------------------------------------------------------------------
# Presentation model: Variant tags + explicit SEO flow to catalogue cards/SEO.
# -----------------------------------------------------------------------------
presentation = "apps/samara-web/my-vite-react-app/src/lib/workspaceProductPresentation.js"
replace_once(
    presentation,
    '''        const collection = projectValues['project.season'] || '';\n        const messagingOwner = resolveWorkspaceMessagingOwner(project, projectValues);''',
    '''        const collection = projectValues['project.season'] || '';\n        const variantTagsPresent = Object.prototype.hasOwnProperty.call(variantValues, 'variant.tags');\n        const variantTags = variantTagsPresent\n          ? asArray(variantValues['variant.tags']).map((item) => String(item)).filter(Boolean)\n          : [];\n        const seoTitle = Object.prototype.hasOwnProperty.call(variantValues, 'variant.seo_title')\n          ? String(variantValues['variant.seo_title'] || '')\n          : undefined;\n        const seoDescription = Object.prototype.hasOwnProperty.call(variantValues, 'variant.seo_description')\n          ? String(variantValues['variant.seo_description'] || '')\n          : undefined;\n        const seoSlug = Object.prototype.hasOwnProperty.call(variantValues, 'variant.seo_slug')\n          ? String(variantValues['variant.seo_slug'] || '')\n          : undefined;\n        const messagingOwner = resolveWorkspaceMessagingOwner(project, projectValues);''',
    "presentation variant discovery values"
)
replace_once(
    presentation,
    '''          tagline: [variantName, fitLabel, collection].filter(Boolean).join(' · '),\n          sizes,''',
    '''          tagline: [variantName, fitLabel, collection].filter(Boolean).join(' · '),\n          variantTagsPresent,\n          collectionTags: variantTags,\n          tags: variantTags,\n          seoTitle,\n          seoDescription,\n          seoSlug,\n          seo: {\n            ...(seoTitle !== undefined ? { title: seoTitle } : {}),\n            ...(seoDescription !== undefined ? { description: seoDescription } : {}),\n            ...(seoSlug !== undefined ? { slug: seoSlug } : {})\n          },\n          sizes,''',
    "presentation output discovery values"
)
replace_once(
    presentation,
    '''      audience: commerce?.audience || 'women',\n      collectionTags: commerce?.collectionTags || commerce?.tags || [],\n      image: presentation.image || commerce?.image || '', ''',
    '''      audience: commerce?.audience || 'women',\n      collectionTags: presentation.variantTagsPresent\n        ? presentation.collectionTags\n        : commerce?.collectionTags || commerce?.tags || [],\n      tags: presentation.variantTagsPresent\n        ? presentation.collectionTags\n        : commerce?.tags || commerce?.collectionTags || [],\n      seoTitle: presentation.seoTitle !== undefined\n        ? presentation.seoTitle\n        : commerce?.seoTitle ?? commerce?.seo?.title ?? '',\n      seoDescription: presentation.seoDescription !== undefined\n        ? presentation.seoDescription\n        : commerce?.seoDescription ?? commerce?.seo?.description ?? '',\n      seoSlug: presentation.seoSlug !== undefined\n        ? presentation.seoSlug\n        : commerce?.seoSlug ?? commerce?.seo?.slug ?? '',\n      seo: {\n        ...(commerce?.seo || {}),\n        ...(presentation.seo || {})\n      },\n      image: presentation.image || commerce?.image || '', ''',
    "presentation overlay discovery precedence"
)
replace_once(
    presentation,
    '''          'description',\n          'measurement chart',\n          'media'\n        ],''',
    '''          'description',\n          'seo',\n          'discovery tags',\n          'measurement chart',\n          'media'\n        ],''',
    "presentation source boundary"
)

# -----------------------------------------------------------------------------
# Catalogue taxonomy helper: DB tag semantics drive surfaces, with legacy fallback.
# -----------------------------------------------------------------------------
taxonomy = "apps/samara-web/my-vite-react-app/src/data/catalogTaxonomy.js"
replace_once(
    taxonomy,
    '''export function getAudienceLabel(audienceId) {\n  return getAudienceById(audienceId)?.label || audienceId;\n}\n''',
    '''export function getAudienceLabel(audienceId) {\n  return getAudienceById(audienceId)?.label || audienceId;\n}\n\nexport function getGovernedProductTags() {\n  const governed = perfectFitMetadata.workspace?.dropdowns?.VARIANT_TAG;\n  return Array.isArray(governed) ? governed : [];\n}\n\nfunction getPatternTagTokens(pattern = {}) {\n  const raw = Array.isArray(pattern.collectionTags)\n    ? pattern.collectionTags\n    : Array.isArray(pattern.tags)\n    ? pattern.tags\n    : [];\n  return [...new Set(raw.map((value) => String(value || '').trim()).filter(Boolean))];\n}\n\nexport function getGovernedTagOption(tagValue) {\n  const token = String(tagValue || '').trim();\n  if (!token) return null;\n  const normalized = slugifyCatalogValue(token);\n  return getGovernedProductTags().find((option) => {\n    const attrs = option?.attrs || {};\n    return (\n      option?.code === token ||\n      slugifyCatalogValue(option?.code) === normalized ||\n      slugifyCatalogValue(attrs.legacy_tag_id) === normalized\n    );\n  }) || null;\n}\n\nexport function isPatternEligibleForSurface(pattern, surfaceTarget) {\n  const target = String(surfaceTarget || '').trim();\n  if (!target) return false;\n  return getPatternTagTokens(pattern).some((tag) => {\n    const option = getGovernedTagOption(tag);\n    const targets = Array.isArray(option?.attrs?.surface_targets)\n      ? option.attrs.surface_targets\n      : [];\n    return targets.includes(target);\n  });\n}\n\nexport function selectPatternsForSurface(patterns, surfaceTarget, limit = 8) {\n  const safe = Array.isArray(patterns) ? patterns.filter(Boolean) : [];\n  const eligible = safe.filter((pattern) => isPatternEligibleForSurface(pattern, surfaceTarget));\n  const source = eligible.length ? eligible : safe;\n  return source.slice(0, Math.max(0, Number(limit) || 0));\n}\n''',
    "catalog governed tag surface helper"
)

# App: select carousel products from governed tag semantics before applying limits.
app = "apps/samara-web/my-vite-react-app/src/App.jsx"
replace_once(
    app,
    "import { slugifyCatalogValue } from './data/catalogTaxonomy';",
    "import { selectPatternsForSurface, slugifyCatalogValue } from './data/catalogTaxonomy';",
    "app surface helper import"
)
replace_once(
    app,
    'patterns={productPresentationPatterns.slice(0, 8)}',
    "patterns={selectPatternsForSurface(productPresentationPatterns, 'signature-orbit-carousel', 8)}",
    "signature orbit governed selection"
)
replace_once(
    app,
    'patterns={productPresentationPatterns.slice(0, 4)}',
    "patterns={selectPatternsForSurface(productPresentationPatterns, 'orbit-carousel', 4)}",
    "legacy orbit governed selection"
)

# Existing PatternSEO consumes explicit variant SEO when provided, retaining generated fallback.
seo = "apps/samara-web/my-vite-react-app/src/components/PatternSEO.jsx"
replace_once(
    seo,
    '''  const avgRating = reviews.length > 0\n    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)\n    : null;\n\n  // JSON-LD structured data object''',
    '''  const avgRating = reviews.length > 0\n    ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)\n    : null;\n\n  const seoTitle =\n    pattern?.seoTitle ??\n    pattern?.seo?.title ??\n    `${pattern?.name || 'Premium Sewing Pattern'} - Sewing Pattern Blueprint | Perfect Fit Bureau`;\n  const seoDescription =\n    pattern?.seoDescription ??\n    pattern?.seo?.description ??\n    pattern?.description ??\n    pattern?.tagline ??\n    '';\n  const seoSlug =\n    pattern?.seoSlug ??\n    pattern?.seo?.slug ??\n    pattern?.id ??\n    'pattern';\n\n  // JSON-LD structured data object''',
    "pattern SEO explicit values"
)
replace_once(
    seo,
    '''    "description": pattern?.description || pattern?.tagline || "",''',
    '''    "description": seoDescription,''',
    "pattern SEO schema description"
)
replace_once(
    seo,
    '''    document.title = `${pattern.name} - Sewing Pattern Blueprint | Perfect Fit Bureau`;''',
    '''    document.title = seoTitle;''',
    "pattern SEO document title"
)
replace_once(
    seo,
    '''    updateMetaTag('name', 'description', pattern.description || pattern.tagline);''',
    '''    updateMetaTag('name', 'description', seoDescription);''',
    "pattern SEO meta description"
)
replace_once(
    seo,
    '''    updateMetaTag('property', 'og:title', `${pattern.name} - Professional Sewing Pattern`);\n    updateMetaTag('property', 'og:description', pattern.description || pattern.tagline);''',
    '''    updateMetaTag('property', 'og:title', seoTitle);\n    updateMetaTag('property', 'og:description', seoDescription);''',
    "pattern SEO open graph"
)
replace_once(
    seo,
    '''    updateMetaTag('name', 'twitter:title', `${pattern.name} - Professional Sewing Pattern`);\n    updateMetaTag('name', 'twitter:description', pattern.description || pattern.tagline);''',
    '''    updateMetaTag('name', 'twitter:title', seoTitle);\n    updateMetaTag('name', 'twitter:description', seoDescription);''',
    "pattern SEO twitter"
)
replace_once(
    seo,
    '''                  <div className="text-[10px] text-bark-450 font-sans mt-0.5 leading-none">\n                    https://bureau.perfectfit.com/patterns/{pattern.id}\n                  </div>''',
    '''                  <div className="text-[10px] text-bark-450 font-sans mt-0.5 leading-none">\n                    https://bureau.perfectfit.com/patterns/{seoSlug}\n                  </div>''',
    "pattern SEO snippet slug"
)
replace_once(
    seo,
    '''                {pattern.name} - Sewing Pattern Blueprint | Perfect Fit Bureau''',
    '''                {seoTitle}''',
    "pattern SEO snippet title"
)
replace_once(
    seo,
    '''                {pattern.description || pattern.tagline} Perfect for {pattern.fabricSuggestions?.slice(0, 3).join(', ')}. Intermediate difficulty sewing blueprint.''',
    '''                {seoDescription} Perfect for {pattern.fabricSuggestions?.slice(0, 3).join(', ')}. Intermediate difficulty sewing blueprint.''',
    "pattern SEO snippet description"
)

print("PF Variant SEO/tags patch completed successfully")
