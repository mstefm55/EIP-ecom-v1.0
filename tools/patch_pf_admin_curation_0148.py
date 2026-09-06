from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path, old, new, label):
    target = ROOT / path
    text = target.read_text(encoding='utf-8')
    if old not in text:
        raise SystemExit(f'{label}: expected source block not found in {path}')
    target.write_text(text.replace(old, new, 1), encoding='utf-8')
    print(f'patched {label}: {path}')


replace_once(
    'services/api/src/services/perfectFit/workspaceProductProjection.js',
    '  if (code === "seo.keywords") return "seo_keywords";\n  if (code === "taxonomy.tags") return "tags";\n  return null;',
    '  if (code === "seo.keywords") return "seo_keywords";\n  return null;',
    'remove designer curation presentation mapping'
)

replace_once(
    'services/api/src/services/perfectFit/workspaceProductProjection.js',
    '''      } else if (presentationField === "tags") {\n        const values = Array.isArray(value)\n          ? value\n          : value === undefined || value === null || value === ""\n          ? []\n          : [value];\n        const normalizedTags = [...new Set(values.map(normalizeText).filter(Boolean))];\n        let invalid = null;\n        if (field.governance_list) {\n          for (const tag of normalizedTags) {\n            // eslint-disable-next-line no-await-in-loop\n            const governed = await validateGovernedDropdownValue(db, {\n              tenantId,\n              listCode: field.governance_list,\n              value: tag\n            });\n            if (!governed.ok) {\n              invalid = { tag, reason: governed.reason };\n              break;\n            }\n          }\n        }\n        if (invalid) {\n          rejected.push({\n            key: field.key,\n            canonical_code: field.canonical_code,\n            reason: invalid.reason,\n            governance_list: field.governance_list,\n            value: invalid.tag\n          });\n          continue;\n        }\n        presentation.tags = normalizedTags;\n        presentationPresence.tags = true;\n      } else {''',
    '''      } else {''',
    'remove designer curation value branch'
)

# Historical workspace keys can remain losslessly, but they are not a storefront curation source.
replace_once(
    'apps/samara-web/my-vite-react-app/src/lib/workspaceProductPresentation.js',
    '''        const variantTagsPresent = Object.prototype.hasOwnProperty.call(variantValues, 'variant.tags');\n        const variantTags = variantTagsPresent\n          ? asArray(variantValues['variant.tags']).map((item) => String(item)).filter(Boolean)\n          : [];\n''',
    '',
    'remove workspace curation extraction'
)
replace_once(
    'apps/samara-web/my-vite-react-app/src/lib/workspaceProductPresentation.js',
    '''          variantTagsPresent,\n          collectionTags: variantTags,\n          tags: variantTags,\n''',
    '',
    'remove workspace curation presentation fields'
)

print('PF admin curation 0148 refinement complete')
