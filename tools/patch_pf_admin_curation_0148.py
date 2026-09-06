from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path, old, new, label):
    target = ROOT / path
    text = target.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'{label}: expected source block not found in {path}')
    updated = text.replace(old, new, 1)
    target.write_text(updated, encoding='utf-8')
    print(f'patched {label}: {path}')


# Ordinary Perfect Fit workspace presentation sync must no longer own taxonomy.tags.
replace_once(
    'services/api/src/services/perfectFit/productGateway.js',
    '  const ownedKeys = ["seo_title", "seo_description", "seo_slug", "seo_keywords", "tags"];',
    '  const ownedKeys = ["seo_title", "seo_description", "seo_slug", "seo_keywords"];',
    'variant presentation ownership'
)

replace_once(
    'services/api/src/services/perfectFit/productGateway.js',
    '''\n    if (presence.tags) {\n      nextAttrs.taxonomy = nextAttrs.taxonomy && typeof nextAttrs.taxonomy === "object"\n        ? { ...nextAttrs.taxonomy }\n        : {};\n      nextAttrs.taxonomy.tags = Array.isArray(presentation.tags)\n        ? [...new Set(presentation.tags.map((item) => String(item || "").trim()).filter(Boolean))]\n        : [];\n    }\n''',
    '\n',
    'remove designer tag write'
)

replace_once(
    'services/api/src/services/perfectFit/productGateway.js',
    '''      updated_fields: ownedKeys.filter((key) => presence?.[key] === true),\n      tags: presence.tags ? nextAttrs.taxonomy?.tags || [] : undefined,\n      seo: nextAttrs.seo || {}''',
    '''      updated_fields: ownedKeys.filter((key) => presence?.[key] === true),\n      seo: nextAttrs.seo || {}''',
    'remove designer tag response'
)

admin_helper = '''\nexport async function syncPerfectFitAdminCuration(db, {\n  tenantId,\n  productId,\n  tags = [],\n  actorIdentityId = null\n}) {\n  return withTransaction(db, async (client) => {\n    const material = await client.query(\n      `SELECT id, attrs\n       FROM eip_core.material\n       WHERE tenant_id=$1\n         AND id=$2\n         AND material_type=$3\n         AND COALESCE(attrs->'product_hierarchy'->>'level', '')='STYLE_VARIANT'\n       FOR UPDATE`,\n      [tenantId, productId, MATERIAL_TYPE]\n    );\n    if (!material.rowCount) return { ok: false, status: 404, error: "STYLE_VARIANT_NOT_FOUND" };\n\n    const nextAttrs = material.rows[0].attrs && typeof material.rows[0].attrs === "object"\n      ? { ...material.rows[0].attrs }\n      : {};\n    const taxonomy = nextAttrs.taxonomy && typeof nextAttrs.taxonomy === "object"\n      ? { ...nextAttrs.taxonomy }\n      : {};\n    taxonomy.tags = Array.isArray(tags)\n      ? [...new Set(tags.map((item) => String(item || "").trim()).filter(Boolean))]\n      : [];\n    nextAttrs.taxonomy = taxonomy;\n    nextAttrs.integration = {\n      ...(nextAttrs.integration || {}),\n      perfect_fit: {\n        ...(nextAttrs.integration?.perfect_fit || {}),\n        curation_synced_at: new Date().toISOString(),\n        curation_updated_by_identity_id: actorIdentityId || null,\n        curation_authority: "MERCHANDISING_ADMIN"\n      }\n    };\n\n    await client.query(\n      `UPDATE eip_core.material SET attrs=$3::jsonb, updated_at=now()\n       WHERE tenant_id=$1 AND id=$2`,\n      [tenantId, productId, JSON.stringify(nextAttrs)]\n    );\n\n    return {\n      ok: true,\n      product_id: productId,\n      tags: taxonomy.tags\n    };\n  });\n}\n\n'''
replace_once(
    'services/api/src/services/perfectFit/productGateway.js',
    '\nexport async function syncPerfectFitProduct(db, {',
    admin_helper + 'export async function syncPerfectFitProduct(db, {',
    'admin curation gateway helper'
)

# Remove taxonomy.tags from ordinary PF field-resolution allowlist.
replace_once(
    'services/api/src/services/perfectFit/workspaceProductProjection.js',
    '  "seo.slug",\n  "seo.keywords",\n  "taxonomy.tags"\n]);',
    '  "seo.slug",\n  "seo.keywords"\n]);',
    'projection canonical allowlist'
)

# Storefront/card presentation must take curation from enterprise commerce overlay, not private workspace.
replace_once(
    'apps/samara-web/my-vite-react-app/src/lib/workspaceProductPresentation.js',
    '''      collectionTags: presentation.variantTagsPresent\n        ? presentation.collectionTags\n        : commerce?.collectionTags || commerce?.tags || [],\n      tags: presentation.variantTagsPresent\n        ? presentation.collectionTags\n        : commerce?.tags || commerce?.collectionTags || [],''',
    '''      collectionTags: commerce?.collectionTags || commerce?.tags || [],\n      tags: commerce?.tags || commerce?.collectionTags || [],''',
    'enterprise curation presentation authority'
)

replace_once(
    'apps/samara-web/my-vite-react-app/src/lib/workspaceProductPresentation.js',
    "          'seo',\n          'discovery tags',\n          'measurement chart',",
    "          'seo',\n          'measurement chart',",
    'source boundary labels'
)

# Add PF Admin curation surface without exposing it to ordinary workspace users.
replace_once(
    'apps/samara-web/my-vite-react-app/src/components/AdminControlPanel.jsx',
    "import PerfectFitLayoutController from './PerfectFitLayoutController';",
    "import PerfectFitLayoutController from './PerfectFitLayoutController';\nimport PerfectFitCurationAdmin from './admin/PerfectFitCurationAdmin';",
    'admin curation import'
)

replace_once(
    'apps/samara-web/my-vite-react-app/src/components/AdminControlPanel.jsx',
    "          { id: 'publication', label: pfUiT('ui.admin.tabs.publication', {}, '🛍️ Publication Moderation'), icon: Store },\n          { id: 'telemetry', label: pfUiT('ui.admin.tabs.telemetry', {}, '📊 System Telemetry & Analytics'), icon: BarChart3 },",
    "          { id: 'publication', label: pfUiT('ui.admin.tabs.publication', {}, '🛍️ Publication Moderation'), icon: Store },\n          { id: 'curation', label: pfUiT('ui.admin.tabs.curation', {}, '🏷️ Product Curation'), icon: Sparkles },\n          { id: 'telemetry', label: pfUiT('ui.admin.tabs.telemetry', {}, '📊 System Telemetry & Analytics'), icon: BarChart3 },",
    'admin curation tab'
)

curation_panel = '''          {/* ==================== TAB: PRODUCT CURATION ==================== */}\n          {activeTab === 'curation' && (\n            <motion.div\n              key="curation-tab-content"\n              initial={{ opacity: 0, y: 5 }}\n              animate={{ opacity: 1, y: 0 }}\n              exit={{ opacity: 0, y: -5 }}\n              className="space-y-6 text-xs text-bark-800"\n            >\n              <PerfectFitCurationAdmin />\n            </motion.div>\n          )}\n\n'''
replace_once(
    'apps/samara-web/my-vite-react-app/src/components/AdminControlPanel.jsx',
    '          {/* ==================== TAB 3: SYSTEM TELEMETRY ==================== */}',
    curation_panel + '          {/* ==================== TAB 3: SYSTEM TELEMETRY ==================== */}',
    'admin curation panel'
)

print('PF admin curation 0148 patch complete')
