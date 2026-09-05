from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str):
    target = ROOT / path
    text = target.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{path}: expected exactly one anchor, found {count}')
    target.write_text(text.replace(old, new, 1), encoding='utf-8')


def write(path: str, content: str):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        raise RuntimeError(f'{path}: target already exists')
    target.write_text(content, encoding='utf-8')


# Canon: document the additive EIP Product SEO keyword array.
replace_once(
    'docs/DEVELOPER_MANUAL.md',
    '- `seo.title`, `seo.description`, `seo.slug`',
    '- `seo.title`, `seo.description`, `seo.slug`, `seo.keywords[]` (free search/discovery terms; distinct from governed `taxonomy.tags`)'
)

# Workspace defaults: older variants remain compatible; new variants start with an empty keyword array.
replace_once(
    'apps/samara-web/my-vite-react-app/src/components/Workspace.jsx',
    "      'variant.seo_slug': values['variant.seo_slug'] || '',\n      'variant.tags': Array.isArray(values['variant.tags']) ? values['variant.tags'] : [],",
    "      'variant.seo_slug': values['variant.seo_slug'] || '',\n      'variant.seo_keywords': Array.isArray(values['variant.seo_keywords']) ? values['variant.seo_keywords'] : [],\n      'variant.tags': Array.isArray(values['variant.tags']) ? values['variant.tags'] : [],"
)

# Workspace generic tag-input state and renderer. Governed multiselect remains a separate renderer.
replace_once(
    'apps/samara-web/my-vite-react-app/src/components/Workspace.jsx',
    "  const options =\n    field.governanceList\n      ? metadata.dropdowns?.[\n          field.governanceList\n        ] || []\n      : [];\n\n  const baseClass =",
    "  const options =\n    field.governanceList\n      ? metadata.dropdowns?.[\n          field.governanceList\n        ] || []\n      : [];\n\n  const [tagInputDraft, setTagInputDraft] = useState('');\n\n  const baseClass ="
)

replace_once(
    'apps/samara-web/my-vite-react-app/src/components/Workspace.jsx',
    "  if (field.type === 'multiselect') {\n",
    "  if (field.type === 'taginput') {\n    const selected = Array.isArray(value) ? value : [];\n    const maxItems = Number(field.maxItems) > 0 ? Number(field.maxItems) : 24;\n    const maxLength = Number(field.maxLength) > 0 ? Number(field.maxLength) : 64;\n\n    const commitKeywords = (rawValue) => {\n      const incoming = String(rawValue || '')\n        .split(',')\n        .map((item) => item.trim().replace(/\\s+/g, ' ').slice(0, maxLength))\n        .filter(Boolean);\n      if (!incoming.length) return;\n\n      const next = [...selected];\n      const known = new Set(next.map((item) => String(item).trim().toLocaleLowerCase()));\n      incoming.forEach((item) => {\n        const token = item.toLocaleLowerCase();\n        if (!known.has(token) && next.length < maxItems) {\n          next.push(item);\n          known.add(token);\n        }\n      });\n      onChange(field.key, next);\n      setTagInputDraft('');\n    };\n\n    return (\n      <div className=\"space-y-2 md:col-span-2\">\n        <label className=\"block text-[10px] font-semibold uppercase tracking-[0.13em] text-bark-500\">\n          {label}\n        </label>\n        <div className=\"flex min-h-[46px] flex-wrap items-center gap-2 rounded-[10px] border border-[#E5E2DA] bg-[#FCFBF8] px-2.5 py-2 transition-colors focus-within:border-[#BCA892] focus-within:ring-1 focus-within:ring-[#BCA892]/30\">\n          {selected.map((item) => (\n            <span\n              key={item}\n              className=\"inline-flex items-center gap-1.5 rounded-full border border-[#DDD8CF] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#4A4741]\"\n            >\n              <span>{item}</span>\n              {!field.readOnly && (\n                <button\n                  type=\"button\"\n                  aria-label={`Remove ${item}`}\n                  onClick={() =>\n                    onChange(\n                      field.key,\n                      selected.filter((keyword) => keyword !== item)\n                    )\n                  }\n                  className=\"rounded-full p-0.5 text-[#8D877D] transition-colors hover:bg-[#F0ECE5] hover:text-[#4A4741]\"\n                >\n                  <X className=\"h-3 w-3\" />\n                </button>\n              )}\n            </span>\n          ))}\n\n          {!field.readOnly && (\n            <div className=\"flex min-w-[190px] flex-1 items-center gap-1.5\">\n              <input\n                type=\"text\"\n                value={tagInputDraft}\n                maxLength={maxLength}\n                disabled={selected.length >= maxItems}\n                placeholder={\n                  selected.length >= maxItems\n                    ? `Maximum ${maxItems} keywords`\n                    : field.placeholder || 'Add a keyword'\n                }\n                onChange={(event) => setTagInputDraft(event.target.value)}\n                onKeyDown={(event) => {\n                  if (event.key === 'Enter' || event.key === ',') {\n                    event.preventDefault();\n                    commitKeywords(tagInputDraft);\n                  }\n                }}\n                className=\"min-w-[140px] flex-1 border-0 bg-transparent px-1.5 py-1 text-[12px] text-[#35322E] outline-none placeholder:text-[#AAA398] disabled:cursor-not-allowed\"\n              />\n              <button\n                type=\"button\"\n                aria-label=\"Add keyword\"\n                disabled={!tagInputDraft.trim() || selected.length >= maxItems}\n                onClick={() => commitKeywords(tagInputDraft)}\n                className=\"inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#D8D1C7] bg-white text-[#735E50] transition-colors hover:border-[#BCA892] hover:bg-[#F5F1EB] disabled:cursor-not-allowed disabled:opacity-35\"\n              >\n                <Plus className=\"h-3.5 w-3.5\" />\n              </button>\n            </div>\n          )}\n        </div>\n        {help && (\n          <p className=\"text-[10px] leading-relaxed text-bark-400\">{help}</p>\n        )}\n      </div>\n    );\n  }\n\n  if (field.type === 'multiselect') {\n"
)

# Projection: keywords are a separate Variant-owned SEO array; governed tags remain taxonomy.tags.
replace_once(
    'services/api/src/services/perfectFit/workspaceProductProjection.js',
    '  "seo.slug",\n  "taxonomy.tags"',
    '  "seo.slug",\n  "seo.keywords",\n  "taxonomy.tags"'
)
replace_once(
    'services/api/src/services/perfectFit/workspaceProductProjection.js',
    '  if (code === "seo.slug") return "seo_slug";\n  if (code === "taxonomy.tags") return "tags";',
    '  if (code === "seo.slug") return "seo_slug";\n  if (code === "seo.keywords") return "seo_keywords";\n  if (code === "taxonomy.tags") return "tags";'
)
replace_once(
    'services/api/src/services/perfectFit/workspaceProductProjection.js',
    '      if (presentationField === "tags") {\n        const values = Array.isArray(value)\n          ? value\n          : value === undefined || value === null || value === ""\n          ? []\n          : [value];\n        const normalizedTags = [...new Set(values.map(normalizeText).filter(Boolean))];\n        let invalid = null;\n        if (field.governance_list) {\n          for (const tag of normalizedTags) {\n            // eslint-disable-next-line no-await-in-loop\n            const governed = await validateGovernedDropdownValue(db, {\n              tenantId,\n              listCode: field.governance_list,\n              value: tag\n            });\n            if (!governed.ok) {\n              invalid = { tag, reason: governed.reason };\n              break;\n            }\n          }\n        }\n        if (invalid) {\n          rejected.push({\n            key: field.key,\n            canonical_code: field.canonical_code,\n            reason: invalid.reason,\n            governance_list: field.governance_list,\n            value: invalid.tag\n          });\n          continue;\n        }\n        presentation.tags = normalizedTags;\n        presentationPresence.tags = true;\n      } else {',
    '      if (presentationField === "tags" || presentationField === "seo_keywords") {\n        const values = Array.isArray(value)\n          ? value\n          : value === undefined || value === null || value === ""\n          ? []\n          : [value];\n        const normalizedValues = [...new Set(\n          values\n            .map(normalizeText)\n            .filter(Boolean)\n            .map((item) => presentationField === "seo_keywords" ? item.slice(0, 64) : item)\n        )].slice(0, presentationField === "seo_keywords" ? 24 : 100);\n        let invalid = null;\n        if (presentationField === "tags" && field.governance_list) {\n          for (const tag of normalizedValues) {\n            // eslint-disable-next-line no-await-in-loop\n            const governed = await validateGovernedDropdownValue(db, {\n              tenantId,\n              listCode: field.governance_list,\n              value: tag\n            });\n            if (!governed.ok) {\n              invalid = { tag, reason: governed.reason };\n              break;\n            }\n          }\n        }\n        if (invalid) {\n          rejected.push({\n            key: field.key,\n            canonical_code: field.canonical_code,\n            reason: invalid.reason,\n            governance_list: field.governance_list,\n            value: invalid.tag\n          });\n          continue;\n        }\n        presentation[presentationField] = normalizedValues;\n        presentationPresence[presentationField] = true;\n      } else {'
)

# Product Gateway: preserve unrelated SEO keys and write/clear seo.keywords independently.
replace_once(
    'services/api/src/services/perfectFit/productGateway.js',
    '  const ownedKeys = ["seo_title", "seo_description", "seo_slug", "tags"];',
    '  const ownedKeys = ["seo_title", "seo_description", "seo_slug", "seo_keywords", "tags"];'
)
replace_once(
    'services/api/src/services/perfectFit/productGateway.js',
    '    if (presence.seo_title || presence.seo_description || presence.seo_slug) {',
    '    if (presence.seo_title || presence.seo_description || presence.seo_slug || presence.seo_keywords) {'
)
replace_once(
    'services/api/src/services/perfectFit/productGateway.js',
    '      if (presence.seo_title) applySeoValue("title", presentation.seo_title);\n      if (presence.seo_description) applySeoValue("description", presentation.seo_description);\n      if (presence.seo_slug) applySeoValue("slug", presentation.seo_slug);\n      if (Object.keys(nextSeo).length) nextAttrs.seo = nextSeo;',
    '      if (presence.seo_title) applySeoValue("title", presentation.seo_title);\n      if (presence.seo_description) applySeoValue("description", presentation.seo_description);\n      if (presence.seo_slug) applySeoValue("slug", presentation.seo_slug);\n      if (presence.seo_keywords) {\n        const keywords = Array.isArray(presentation.seo_keywords)\n          ? [...new Set(\n              presentation.seo_keywords\n                .map((item) => String(item || "").trim().replace(/\\s+/g, " ").slice(0, 64))\n                .filter(Boolean)\n            )].slice(0, 24)\n          : [];\n        if (keywords.length) nextSeo.keywords = keywords;\n        else delete nextSeo.keywords;\n      }\n      if (Object.keys(nextSeo).length) nextAttrs.seo = nextSeo;'
)

# Catalogue presentation: expose keywords to SEO only; keep curation tags on collectionTags/tags.
replace_once(
    'apps/samara-web/my-vite-react-app/src/lib/workspaceProductPresentation.js',
    "        const seoSlug = Object.prototype.hasOwnProperty.call(variantValues, 'variant.seo_slug')\n          ? String(variantValues['variant.seo_slug'] || '')\n          : undefined;",
    "        const seoSlug = Object.prototype.hasOwnProperty.call(variantValues, 'variant.seo_slug')\n          ? String(variantValues['variant.seo_slug'] || '')\n          : undefined;\n        const seoKeywordsPresent = Object.prototype.hasOwnProperty.call(variantValues, 'variant.seo_keywords');\n        const seoKeywords = seoKeywordsPresent\n          ? asArray(variantValues['variant.seo_keywords']).map((item) => String(item).trim()).filter(Boolean)\n          : undefined;"
)
replace_once(
    'apps/samara-web/my-vite-react-app/src/lib/workspaceProductPresentation.js',
    "          seoSlug,\n          seo: {\n            ...(seoTitle !== undefined ? { title: seoTitle } : {}),\n            ...(seoDescription !== undefined ? { description: seoDescription } : {}),\n            ...(seoSlug !== undefined ? { slug: seoSlug } : {})\n          },",
    "          seoSlug,\n          seoKeywordsPresent,\n          seoKeywords,\n          seo: {\n            ...(seoTitle !== undefined ? { title: seoTitle } : {}),\n            ...(seoDescription !== undefined ? { description: seoDescription } : {}),\n            ...(seoSlug !== undefined ? { slug: seoSlug } : {}),\n            ...(seoKeywords !== undefined ? { keywords: seoKeywords } : {})\n          },"
)
replace_once(
    'apps/samara-web/my-vite-react-app/src/lib/workspaceProductPresentation.js',
    "      seoSlug: presentation.seoSlug !== undefined\n        ? presentation.seoSlug\n        : commerce?.seoSlug ?? commerce?.seo?.slug ?? '',\n      seo: {",
    "      seoSlug: presentation.seoSlug !== undefined\n        ? presentation.seoSlug\n        : commerce?.seoSlug ?? commerce?.seo?.slug ?? '',\n      seoKeywords: presentation.seoKeywordsPresent\n        ? presentation.seoKeywords || []\n        : commerce?.seoKeywords ?? commerce?.seo?.keywords ?? [],\n      seo: {"
)

# SEO engine: explicit free Variant keywords override generated legacy keyword string.
replace_once(
    'apps/samara-web/my-vite-react-app/src/components/PatternSEO.jsx',
    "  const seoSlug =\n    pattern?.seoSlug ??\n    pattern?.seo?.slug ??\n    pattern?.id ??\n    'pattern';",
    "  const seoSlug =\n    pattern?.seoSlug ??\n    pattern?.seo?.slug ??\n    pattern?.id ??\n    'pattern';\n  const seoKeywords = Array.isArray(pattern?.seoKeywords)\n    ? pattern.seoKeywords\n    : Array.isArray(pattern?.seo?.keywords)\n    ? pattern.seo.keywords\n    : [];\n  const seoKeywordContent = seoKeywords.length\n    ? seoKeywords.join(', ')\n    : `sewing pattern, ${pattern?.category || ''}, digital pattern, pdf pattern, printable pattern, couture, tailoring, ${pattern?.name || ''}`;"
)
replace_once(
    'apps/samara-web/my-vite-react-app/src/components/PatternSEO.jsx',
    "    updateMetaTag('name', 'keywords', `sewing pattern, ${pattern.category}, digital pattern, pdf pattern, printable pattern, couture, tailoring, ${pattern.name}`);",
    "    updateMetaTag('name', 'keywords', seoKeywordContent);"
)

migration = r'''-- 0147_perfect_fit_variant_keywords_curation.sql
-- Purpose:
--   Correct the 0146 presentation contract by separating free SEO keywords
--   from governed merchandising/curation tags.
--
--   variant.seo_keywords -> material.attrs.seo.keywords (free-entry array)
--   variant.tags         -> material.attrs.taxonomy.tags (governed curation)
--
-- 0144, 0145 and 0146 are executed history and are intentionally not modified.

BEGIN;

CREATE TEMP TABLE _pf_0147_tenants ON COMMIT DROP AS
SELECT DISTINCT t.id AS tenant_id
FROM eip_core.tenant t
CROSS JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN jsonb_typeof(t.attrs->'connection_profiles') = 'array'
    THEN t.attrs->'connection_profiles'
    ELSE '[]'::jsonb
  END
) AS profile
WHERE t.is_active = true
  AND (
    lower(COALESCE(profile->'public_storefront'->>'perfect_fit_enabled', 'false')) = 'true'
    OR COALESCE(profile->'public_storefront'->'scopes', '[]'::jsonb) ? 'perfect_fit.products.read'
  );

-- Keep the 0146 vocabulary and behavior, but make its semantic role explicit.
UPDATE eip_core.dropdown_list dl
SET attrs = COALESCE(dl.attrs, '{}'::jsonb) || jsonb_build_object(
  'authority', 'EIP_DB',
  'presentation_role', 'CURATION_PLACEMENT',
  'free_keywords_separate', true,
  'seed_migration', '0147'
)
FROM _pf_0147_tenants t
WHERE dl.tenant_id = t.tenant_id
  AND dl.module = 'perfect_fit'
  AND dl.code = 'PF_PRODUCT_TAG'
  AND dl.version = 1;

-- Add the explicit PF -> canonical EIP alias for free SEO keywords.
INSERT INTO eip_commerce.socket_alias_map
  (tenant_id, map_kind, alias_code, canonical_code, attrs, is_active)
SELECT
  t.tenant_id,
  'FIELD',
  'variant.seo_keywords',
  'seo.keywords',
  jsonb_build_object(
    'application', 'perfect_fit',
    'authority', 'EIP_DB',
    'entity_level', 'STYLE_VARIANT',
    'value_kind', 'FREE_TEXT_ARRAY',
    'seed_migration', '0147'
  ),
  true
FROM _pf_0147_tenants t
WHERE NOT EXISTS (
  SELECT 1
  FROM eip_commerce.socket_alias_map existing
  WHERE existing.tenant_id = t.tenant_id
    AND existing.map_kind = 'FIELD'
    AND existing.alias_code = 'variant.seo_keywords'
    AND existing.is_active = true
);

-- Fail rather than silently leaving a PF-enabled tenant without a runtime manifest.
DO $$
DECLARE missing_count integer;
BEGIN
  SELECT count(*) INTO missing_count
  FROM _pf_0147_tenants t
  WHERE NOT EXISTS (
    SELECT 1
    FROM eip_commerce.socket_manifest sm
    WHERE sm.tenant_id = t.tenant_id
      AND sm.code = 'PERFECT_FIT'
      AND sm.is_published = true
  );

  IF missing_count > 0 THEN
    RAISE EXCEPTION '0147 requires a published PERFECT_FIT manifest for every PF-enabled tenant; missing=%', missing_count;
  END IF;
END $$;

-- Publish a versioned successor manifest. History is retained by unpublishing,
-- never overwriting, the previously published row.
WITH current_manifest AS (
  SELECT DISTINCT ON (sm.tenant_id)
    sm.id,
    sm.tenant_id,
    sm.code,
    sm.version,
    sm.manifest,
    sm.attrs
  FROM eip_commerce.socket_manifest sm
  JOIN _pf_0147_tenants t ON t.tenant_id = sm.tenant_id
  WHERE sm.code = 'PERFECT_FIT'
    AND sm.is_published = true
  ORDER BY sm.tenant_id, sm.version DESC, sm.updated_at DESC
), unpublished AS (
  UPDATE eip_commerce.socket_manifest sm
  SET is_published = false,
      updated_at = now()
  FROM current_manifest current
  WHERE sm.id = current.id
  RETURNING
    current.tenant_id,
    current.code,
    current.version,
    current.manifest,
    current.attrs
), patched AS (
  SELECT
    tenant_id,
    code,
    version + 1 AS next_version,
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              manifest,
              '{workspace,version}',
              to_jsonb('2026-09-05-db-workspace-v3'::text),
              true
            ),
            '{workspace,fields,variant.seo_keywords}',
            '{"key":"variant.seo_keywords","label":"Keywords","help":"Free search keywords. Press Enter or comma, or use Add. Keywords do not control Orbit placement.","placeholder":"Add a keyword","type":"taginput","allowFreeText":true,"usedAsEipParameter":true,"maxItems":24,"maxLength":64}'::jsonb,
            true
          ),
          '{workspace,fields,variant.tags}',
          '{"key":"variant.tags","label":"Curation & placement","help":"Governed merchandising choices can drive catalogue facets, badges and presentation surfaces such as Orbit Featured.","type":"multiselect","governanceList":"VARIANT_TAG","allowFreeText":false,"usedAsEipParameter":true}'::jsonb,
          true
        ),
        '{workspace,fieldGroups,variantDiscoverySeo,fields}',
        '["variant.seo_title","variant.seo_description","variant.seo_slug","variant.seo_keywords","variant.tags"]'::jsonb,
        true
      ),
      '{workspace,discovery,keywordField}',
      to_jsonb('variant.seo_keywords'::text),
      true
    ) AS manifest,
    COALESCE(attrs, '{}'::jsonb) || jsonb_build_object(
      'application', 'perfect_fit',
      'authority', 'EIP_DB',
      'metadata_scope', 'workspace_runtime',
      'seed_migration', '0147'
    ) AS attrs
  FROM unpublished
)
INSERT INTO eip_commerce.socket_manifest
  (tenant_id, code, version, is_published, published_at, manifest, attrs)
SELECT
  tenant_id,
  code,
  next_version,
  true,
  now(),
  manifest,
  attrs
FROM patched;

COMMIT;
'''
write('services/api/db/migrations/0147_perfect_fit_variant_keywords_curation.sql', migration)


test_file = r'''import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { syncPerfectFitVariantPresentation } from '../src/services/perfectFit/productGateway.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

const migration = read('services/api/db/migrations/0147_perfect_fit_variant_keywords_curation.sql');
const workspace = read('apps/samara-web/my-vite-react-app/src/components/Workspace.jsx');
const projection = read('services/api/src/services/perfectFit/workspaceProductProjection.js');
const presentation = read('apps/samara-web/my-vite-react-app/src/lib/workspaceProductPresentation.js');
const taxonomy = read('apps/samara-web/my-vite-react-app/src/data/catalogTaxonomy.js');
const seo = read('apps/samara-web/my-vite-react-app/src/components/PatternSEO.jsx');
const manual = read('docs/DEVELOPER_MANUAL.md');

function makeDb(existingAttrs = {}) {
  const state = { updatedAttrs: null, connected: 0, released: 0 };
  const client = {
    async query(sql, params = []) {
      if (/SELECT id, attrs/i.test(sql)) {
        return { rowCount: 1, rows: [{ id: 'product-1', attrs: structuredClone(existingAttrs) }] };
      }
      if (/UPDATE eip_core\.material SET attrs=/i.test(sql)) {
        state.updatedAttrs = JSON.parse(params[2]);
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    },
    release() { state.released += 1; }
  };
  return {
    state,
    db: {
      async connect() {
        state.connected += 1;
        return client;
      }
    }
  };
}

test('0147 adds free SEO keywords without replacing governed curation', () => {
  assert.match(migration, /variant\.seo_keywords/);
  assert.match(migration, /seo\.keywords/);
  assert.match(migration, /FREE_TEXT_ARRAY/);
  assert.match(migration, /PF_PRODUCT_TAG/);
  assert.match(migration, /Curation & placement/);
  assert.match(migration, /"type":"taginput"/);
  assert.match(migration, /"allowFreeText":true/);
  assert.match(migration, /"governanceList":"VARIANT_TAG"/);
  assert.doesNotMatch(migration, /DROP TABLE/i);
  assert.doesNotMatch(migration, /CREATE\s+TABLE\s+eip_(?:core|commerce)\.[a-z0-9_]*perfect_fit/i);
});

test('EIP Product canon documents seo.keywords separately from taxonomy.tags', () => {
  assert.match(manual, /seo\.keywords\[\]/);
  assert.match(manual, /distinct from governed `taxonomy\.tags`/);
});

test('Workspace provides free chip input plus separate governed curation selector', () => {
  assert.match(workspace, /field\.type === 'taginput'/);
  assert.match(workspace, /event\.key === 'Enter' \|\| event\.key === ','/);
  assert.match(workspace, /aria-label="Add keyword"/);
  assert.match(workspace, /Remove \$\{item\}/);
  assert.match(workspace, /field\.type === 'multiselect'/);
  assert.match(workspace, /metadata\.dropdowns\?\.\[field\.governanceList\]/);
});

test('projection recognizes seo.keywords but governance validation remains specific to curation tags', () => {
  assert.match(projection, /"seo\.keywords"/);
  assert.match(projection, /return "seo_keywords"/);
  assert.match(projection, /presentationField === "tags" && field\.governance_list/);
  assert.match(projection, /presentationField === "tags" \|\| presentationField === "seo_keywords"/);
});

test('Variant keyword sync preserves unrelated SEO and curation values', async () => {
  const { db, state } = makeDb({
    seo: { title: 'Keep title', robots: 'index,follow' },
    taxonomy: { category: 'Dresses', tags: ['ORBIT_FEATURED'] },
    inventory: { qty: 7 }
  });

  const result = await syncPerfectFitVariantPresentation(db, {
    tenantId: 'tenant-1',
    productId: 'product-1',
    presentation: {
      seo_keywords: ['bias cut', ' linen ', 'bias cut']
    },
    presence: { seo_keywords: true }
  });

  assert.equal(result.ok, true);
  assert.deepEqual(state.updatedAttrs.seo.keywords, ['bias cut', 'linen']);
  assert.equal(state.updatedAttrs.seo.title, 'Keep title');
  assert.equal(state.updatedAttrs.seo.robots, 'index,follow');
  assert.deepEqual(state.updatedAttrs.taxonomy.tags, ['ORBIT_FEATURED']);
  assert.equal(state.updatedAttrs.inventory.qty, 7);
});

test('explicit empty keywords clear only seo.keywords', async () => {
  const { db, state } = makeDb({
    seo: { title: 'Keep', keywords: ['old'], robots: 'index' },
    taxonomy: { tags: ['BEST_SELLER'] }
  });

  await syncPerfectFitVariantPresentation(db, {
    tenantId: 'tenant-1',
    productId: 'product-1',
    presentation: { seo_keywords: [] },
    presence: { seo_keywords: true }
  });

  assert.equal(state.updatedAttrs.seo.keywords, undefined);
  assert.equal(state.updatedAttrs.seo.title, 'Keep');
  assert.equal(state.updatedAttrs.seo.robots, 'index');
  assert.deepEqual(state.updatedAttrs.taxonomy.tags, ['BEST_SELLER']);
});

test('catalogue presentation exposes keywords to SEO but Orbit remains curation-driven', () => {
  assert.match(presentation, /variant\.seo_keywords/);
  assert.match(presentation, /seoKeywords/);
  assert.match(seo, /seoKeywordContent/);
  assert.match(seo, /seoKeywords\.join\(', '\)/);
  assert.match(taxonomy, /getPatternTagTokens/);
  assert.match(taxonomy, /collectionTags/);
  assert.doesNotMatch(taxonomy, /seoKeywords/);
});
'''
write('services/api/test/perfect_fit_variant_keywords_curation.test.mjs', test_file)

print('PF 0147 keyword/curation patch applied successfully')
