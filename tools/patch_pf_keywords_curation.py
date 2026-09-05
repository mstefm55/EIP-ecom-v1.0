from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def patch(path, replacements):
    target = ROOT / path
    text = target.read_text(encoding='utf-8')
    for old, new in replacements:
        if old not in text:
            raise SystemExit(f'Missing patch anchor in {path}: {old[:120]!r}')
        text = text.replace(old, new, 1)
    target.write_text(text, encoding='utf-8')


patch(
    'apps/samara-web/my-vite-react-app/src/components/Workspace.jsx',
    [
        (
            "      'variant.seo_slug': values['variant.seo_slug'] || '',\n      'variant.tags': Array.isArray(values['variant.tags']) ? values['variant.tags'] : [],",
            "      'variant.seo_slug': values['variant.seo_slug'] || '',\n      'variant.seo_keywords': Array.isArray(values['variant.seo_keywords']) ? values['variant.seo_keywords'] : [],\n      'variant.tags': Array.isArray(values['variant.tags']) ? values['variant.tags'] : [],"
        ),
        (
            "  const baseClass =\n    'w-full rounded-[9px] border border-[#E5E2DA] bg-[#FCFBF8] px-3 py-2 text-[13px] text-[#272622] transition-colors focus:border-[#BCA892] focus:outline-none focus:ring-1 focus:ring-[#BCA892]/30 disabled:bg-[#F4F2ED] disabled:text-[#918D84]';\n\n  const optionLabel = (option) =>",
            "  const baseClass =\n    'w-full rounded-[9px] border border-[#E5E2DA] bg-[#FCFBF8] px-3 py-2 text-[13px] text-[#272622] transition-colors focus:border-[#BCA892] focus:outline-none focus:ring-1 focus:ring-[#BCA892]/30 disabled:bg-[#F4F2ED] disabled:text-[#918D84]';\n  const [tagDraft, setTagDraft] = useState('');\n\n  const optionLabel = (option) =>"
        ),
        (
            "  if (field.type === 'multiselect') {\n",
            "  if (field.type === 'tagInput') {\n    const selected = Array.isArray(value) ? value : [];\n    const maxItems = Number(field.maxItems) > 0 ? Number(field.maxItems) : 30;\n    const maxItemLength = Number(field.maxItemLength) > 0 ? Number(field.maxItemLength) : 80;\n\n    const addKeywords = (rawValue) => {\n      const incoming = String(rawValue || '')\n        .split(',')\n        .map((item) => item.trim().replace(/\\s+/g, ' '))\n        .filter(Boolean)\n        .map((item) => item.slice(0, maxItemLength));\n      if (!incoming.length) return;\n\n      const seen = new Set(selected.map((item) => String(item).trim().toLocaleLowerCase()));\n      const next = [...selected];\n      incoming.forEach((item) => {\n        const normalized = item.toLocaleLowerCase();\n        if (!seen.has(normalized) && next.length < maxItems) {\n          seen.add(normalized);\n          next.push(item);\n        }\n      });\n      onChange(field.key, next);\n      setTagDraft('');\n    };\n\n    return (\n      <div className=\"space-y-2 md:col-span-2\">\n        <label className=\"block text-[10px] font-semibold uppercase tracking-[0.13em] text-bark-500\">\n          {label}\n        </label>\n        <div className=\"flex min-h-[48px] flex-wrap items-center gap-2 rounded-[11px] border border-[#E5E2DA] bg-[#FCFBF8] px-3 py-2 transition-colors focus-within:border-[#BCA892] focus-within:ring-1 focus-within:ring-[#BCA892]/30\">\n          {selected.map((keyword) => (\n            <span\n              key={keyword}\n              className=\"inline-flex items-center gap-1.5 rounded-full border border-[#DED9D0] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#4A4741]\"\n            >\n              {keyword}\n              {!field.readOnly && (\n                <button\n                  type=\"button\"\n                  aria-label={`Remove ${keyword}`}\n                  onClick={() => onChange(field.key, selected.filter((item) => item !== keyword))}\n                  className=\"rounded-full p-0.5 text-[#8B867D] transition-colors hover:bg-[#F0EDE7] hover:text-[#4A4741]\"\n                >\n                  <X className=\"h-3 w-3\" />\n                </button>\n              )}\n            </span>\n          ))}\n          {!field.readOnly && (\n            <div className=\"flex min-w-[190px] flex-1 items-center gap-1\">\n              <input\n                type=\"text\"\n                value={tagDraft}\n                maxLength={maxItemLength}\n                placeholder={field.placeholder || 'Add keyword'}\n                onChange={(event) => setTagDraft(event.target.value)}\n                onKeyDown={(event) => {\n                  if (event.key === 'Enter' || event.key === ',') {\n                    event.preventDefault();\n                    addKeywords(tagDraft);\n                  }\n                }}\n                onBlur={() => {\n                  if (tagDraft.trim()) addKeywords(tagDraft);\n                }}\n                className=\"min-w-0 flex-1 border-0 bg-transparent px-1 py-1.5 text-[12px] text-[#272622] outline-none placeholder:text-[#A19C92]\"\n              />\n              <button\n                type=\"button\"\n                disabled={!tagDraft.trim() || selected.length >= maxItems}\n                onMouseDown={(event) => event.preventDefault()}\n                onClick={() => addKeywords(tagDraft)}\n                className=\"inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#D9D5CC] bg-white text-[#6F6258] transition-colors hover:border-[#BCA892] hover:bg-[#F5F1EB] disabled:cursor-not-allowed disabled:opacity-35\"\n                aria-label=\"Add keyword\"\n              >\n                <Plus className=\"h-3.5 w-3.5\" />\n              </button>\n            </div>\n          )}\n        </div>\n        {help && (\n          <p className=\"text-[10px] leading-relaxed text-bark-400\">{help}</p>\n        )}\n      </div>\n    );\n  }\n\n  if (field.type === 'multiselect') {\n"
        ),
    ],
)

patch(
    'services/api/src/services/perfectFit/workspaceProductProjection.js',
    [
        (
            '  "seo.slug",\n  "taxonomy.tags"',
            '  "seo.slug",\n  "seo.keywords",\n  "taxonomy.tags"'
        ),
        (
            '  if (code === "seo.slug") return "seo_slug";\n  if (code === "taxonomy.tags") return "tags";',
            '  if (code === "seo.slug") return "seo_slug";\n  if (code === "seo.keywords") return "seo_keywords";\n  if (code === "taxonomy.tags") return "tags";'
        ),
        (
            '      if (presentationField === "tags") {',
            '      if (presentationField === "seo_keywords") {\n        const values = Array.isArray(value)\n          ? value\n          : value === undefined || value === null || value === ""\n          ? []\n          : [value];\n        presentation.seo_keywords = [\n          ...new Set(values.map(normalizeText).filter(Boolean))\n        ];\n        presentationPresence.seo_keywords = true;\n      } else if (presentationField === "tags") {'
        ),
    ],
)

patch(
    'services/api/src/services/perfectFit/productGateway.js',
    [
        (
            '  const ownedKeys = ["seo_title", "seo_description", "seo_slug", "tags"];',
            '  const ownedKeys = ["seo_title", "seo_description", "seo_slug", "seo_keywords", "tags"];'
        ),
        (
            '    if (presence.seo_title || presence.seo_description || presence.seo_slug) {',
            '    if (presence.seo_title || presence.seo_description || presence.seo_slug || presence.seo_keywords) {'
        ),
        (
            '      if (presence.seo_slug) applySeoValue("slug", presentation.seo_slug);\n      if (Object.keys(nextSeo).length) nextAttrs.seo = nextSeo;',
            '      if (presence.seo_slug) applySeoValue("slug", presentation.seo_slug);\n      if (presence.seo_keywords) {\n        const keywords = Array.isArray(presentation.seo_keywords)\n          ? [...new Set(presentation.seo_keywords.map((item) => String(item || "").trim()).filter(Boolean))]\n          : [];\n        if (keywords.length) nextSeo.keywords = keywords;\n        else delete nextSeo.keywords;\n      }\n      if (Object.keys(nextSeo).length) nextAttrs.seo = nextSeo;'
        ),
    ],
)

patch(
    'apps/samara-web/my-vite-react-app/src/lib/workspaceProductPresentation.js',
    [
        (
            "        const seoSlug = Object.prototype.hasOwnProperty.call(variantValues, 'variant.seo_slug')\n          ? String(variantValues['variant.seo_slug'] || '')\n          : undefined;",
            "        const seoSlug = Object.prototype.hasOwnProperty.call(variantValues, 'variant.seo_slug')\n          ? String(variantValues['variant.seo_slug'] || '')\n          : undefined;\n        const seoKeywordsPresent = Object.prototype.hasOwnProperty.call(variantValues, 'variant.seo_keywords');\n        const seoKeywords = seoKeywordsPresent\n          ? asArray(variantValues['variant.seo_keywords']).map((item) => String(item).trim()).filter(Boolean)\n          : [];"
        ),
        (
            "          seoSlug,\n          seo: {\n            ...(seoTitle !== undefined ? { title: seoTitle } : {}),\n            ...(seoDescription !== undefined ? { description: seoDescription } : {}),\n            ...(seoSlug !== undefined ? { slug: seoSlug } : {})\n          },",
            "          seoSlug,\n          seoKeywordsPresent,\n          seoKeywords,\n          seo: {\n            ...(seoTitle !== undefined ? { title: seoTitle } : {}),\n            ...(seoDescription !== undefined ? { description: seoDescription } : {}),\n            ...(seoSlug !== undefined ? { slug: seoSlug } : {}),\n            ...(seoKeywordsPresent ? { keywords: seoKeywords } : {})\n          },"
        ),
        (
            "      seoSlug: presentation.seoSlug !== undefined\n        ? presentation.seoSlug\n        : commerce?.seoSlug ?? commerce?.seo?.slug ?? '',\n      seo: {",
            "      seoSlug: presentation.seoSlug !== undefined\n        ? presentation.seoSlug\n        : commerce?.seoSlug ?? commerce?.seo?.slug ?? '',\n      seoKeywords: presentation.seoKeywordsPresent\n        ? presentation.seoKeywords\n        : commerce?.seoKeywords ?? commerce?.seo?.keywords ?? [],\n      seo: {"
        ),
    ],
)

patch(
    'apps/samara-web/my-vite-react-app/src/components/PatternSEO.jsx',
    [
        (
            "  const seoSlug =\n    pattern?.seoSlug ??\n    pattern?.seo?.slug ??\n    pattern?.id ??\n    'pattern';",
            "  const seoSlug =\n    pattern?.seoSlug ??\n    pattern?.seo?.slug ??\n    pattern?.id ??\n    'pattern';\n  const seoKeywords = Array.isArray(pattern?.seoKeywords)\n    ? pattern.seoKeywords\n    : Array.isArray(pattern?.seo?.keywords)\n    ? pattern.seo.keywords\n    : [];\n  const metaKeywords = seoKeywords.length\n    ? seoKeywords.join(', ')\n    : `sewing pattern, ${pattern?.category || ''}, digital pattern, pdf pattern, printable pattern, couture, tailoring, ${pattern?.name || ''}`;"
        ),
        (
            "    updateMetaTag('name', 'keywords', `sewing pattern, ${pattern.category}, digital pattern, pdf pattern, printable pattern, couture, tailoring, ${pattern.name}`);",
            "    updateMetaTag('name', 'keywords', metaKeywords);"
        ),
    ],
)

print('PF keyword/curation patch applied')
