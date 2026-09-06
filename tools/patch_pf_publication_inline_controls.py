from pathlib import Path


def replace_once(path, old, new):
    file_path = Path(path)
    text = file_path.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly one match in {path}, found {count}: {old[:120]!r}")
    file_path.write_text(text.replace(old, new, 1), encoding="utf-8")


admin_path = "apps/samara-web/my-vite-react-app/src/components/AdminControlPanel.jsx"
replace_once(
    admin_path,
    "import PerfectFitCurationAdmin from './admin/PerfectFitCurationAdmin';\n",
    "import PerfectFitCurationAdmin from './admin/PerfectFitCurationAdmin';\nimport PublicationModerationCuration from './admin/PublicationModerationCuration';\n",
)
replace_once(
    admin_path,
    "  onOpenPublicationReview = () => {},\n  onMessagePublicationDesigner = () => {},\n",
    "  onOpenPublicationReview = () => {},\n  onApprovePublication = () => {},\n  onMessagePublicationDesigner = () => {},\n",
)
replace_once(
    admin_path,
    "                        <div className=\"flex flex-wrap items-center justify-between gap-2 border-t border-sand-150 bg-[#FAF8F5]/55 px-4 py-3\">\n",
    "                        <PublicationModerationCuration request={request} />\n\n                        <div className=\"flex flex-wrap items-center justify-between gap-2 border-t border-sand-150 bg-[#FAF8F5]/55 px-4 py-3\">\n",
)
replace_once(
    admin_path,
    "                          <button\n                            type=\"button\"\n                            onClick={() => onOpenPublicationReview(request)}\n                            disabled={!request.pattern}\n",
    "                          {isPending && (\n                            <button\n                              type=\"button\"\n                              onClick={() => {\n                                const confirmed = window.confirm(\n                                  `Approve and publish \\\"${request.styleName || 'this product'}\\\" to customer-facing catalogue surfaces?`\n                                );\n                                if (confirmed) onApprovePublication(request);\n                              }}\n                              className=\"inline-flex items-center gap-1.5 rounded-lg border border-emerald-700 bg-emerald-700 px-4 py-2 text-[9px] font-bold text-white shadow-3xs hover:bg-emerald-800\"\n                            >\n                              <Check className=\"w-3.5 h-3.5\" /> Approve &amp; Publish\n                            </button>\n                          )}\n\n                          <button\n                            type=\"button\"\n                            onClick={() => onOpenPublicationReview(request)}\n                            disabled={!request.pattern}\n",
)

app_path = "apps/samara-web/my-vite-react-app/src/App.jsx"
replace_once(
    app_path,
    "      onOpenPublicationReview={handleOpenPublicationReview}\n      onMessagePublicationDesigner={handleOpenModeratorMessage}\n",
    "      onOpenPublicationReview={handleOpenPublicationReview}\n      onApprovePublication={handleModeratorApprove}\n      onMessagePublicationDesigner={handleOpenModeratorMessage}\n",
)

route_path = "services/api/src/routes/public_perfect_fit_admin.js"
replace_once(
    route_path,
    "        searchSql = `AND (lower(m.name) LIKE $3 OR lower(m.code) LIKE $3)`;\n",
    "        searchSql = `AND (\n          lower(m.name) LIKE $3\n          OR lower(m.code) LIKE $3\n          OR lower(COALESCE(pf.perfect_fit->>'variant_code', '')) LIKE $3\n          OR lower(COALESCE(pf.perfect_fit->>'style_code', '')) LIKE $3\n          OR lower(COALESCE(pf.perfect_fit->>'variant_id', '')) LIKE $3\n          OR lower(COALESCE(pf.perfect_fit->>'style_id', '')) LIKE $3\n        )`;\n",
)
replace_once(
    route_path,
    "        SELECT m.id, m.code, m.name, m.attrs, m.updated_at\n        FROM eip_core.material m\n        WHERE m.tenant_id = $1\n",
    "        SELECT m.id, m.code, m.name, m.attrs, m.updated_at, pf.perfect_fit\n        FROM eip_core.material m\n        LEFT JOIN LATERAL (\n          SELECT ir.payload->'perfect_fit' AS perfect_fit\n          FROM eip_core.object_link ol\n          JOIN eip_core.info_record ir\n            ON ir.tenant_id = ol.tenant_id\n           AND ir.id = ol.dst_id\n           AND ir.record_type = 'PERFECT_FIT_PRODUCT_LINK'\n           AND ir.is_active = true\n          WHERE ol.tenant_id = m.tenant_id\n            AND ol.src_kind = 'material'\n            AND ol.src_id = m.id\n            AND ol.dst_kind = 'info_record'\n            AND ol.relation_type = 'PERFECT_FIT_PRODUCT'\n            AND ol.is_active = true\n          ORDER BY ol.updated_at DESC\n          LIMIT 1\n        ) pf ON true\n        WHERE m.tenant_id = $1\n",
)
replace_once(
    route_path,
    "          tags: Array.isArray(row.attrs?.taxonomy?.tags) ? row.attrs.taxonomy.tags : [],\n          product_level: row.attrs?.product_hierarchy?.level || null,\n",
    "          tags: Array.isArray(row.attrs?.taxonomy?.tags) ? row.attrs.taxonomy.tags : [],\n          perfect_fit: row.perfect_fit && typeof row.perfect_fit === 'object' ? row.perfect_fit : null,\n          product_level: row.attrs?.product_hierarchy?.level || null,\n",
)

print("Applied PF publication inline approval + curation patch")
