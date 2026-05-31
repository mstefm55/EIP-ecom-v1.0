const PRODUCT_SOURCE_MODES = new Set([
  "manual_products",
  "product_tag",
  "collection_or_drop",
  "hybrid_tag_overrides"
]);

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeCode(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeCodeList(input) {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.map(normalizeCode).filter(Boolean))).slice(0, 200);
}

function normalizeProductSource(attrs = {}) {
  const raw = attrs.product_source && typeof attrs.product_source === "object"
    ? attrs.product_source
    : {};
  const sourceMode = normalizeCode(attrs.source_mode || raw.mode);
  if (!PRODUCT_SOURCE_MODES.has(sourceMode)) return null;
  const tag = normalizeCode(raw.tag || attrs.product_tag || attrs.tag);
  return {
    mode: sourceMode,
    tag,
    tags: normalizeCodeList(raw.tags || (tag ? [tag] : [])),
    product_codes: normalizeCodeList(raw.product_codes || raw.products || attrs.product_codes),
    include_product_codes: normalizeCodeList(raw.include_product_codes || raw.overrides || attrs.include_product_codes),
    exclude_product_codes: normalizeCodeList(raw.exclude_product_codes || attrs.exclude_product_codes),
    collection_code: normalizeCode(raw.collection_code || attrs.collection_code),
    limit: Math.max(1, Math.min(100, Number(raw.limit || attrs.product_limit || 24)))
  };
}

function materialTags(row = {}) {
  const attrs = row.attrs && typeof row.attrs === "object" ? row.attrs : {};
  const taxonomy = attrs.taxonomy && typeof attrs.taxonomy === "object" ? attrs.taxonomy : {};
  const tags = Array.isArray(taxonomy.tags) ? taxonomy.tags : [];
  return new Set(
    [
      ...tags,
      taxonomy.category_code,
      taxonomy.category,
      taxonomy.collection_code,
      attrs.collection_code
    ]
      .map(normalizeCode)
      .filter(Boolean)
  );
}

function matchesTag(row, source) {
  const tags = materialTags(row);
  if (source.collection_code && tags.has(source.collection_code)) return true;
  return source.tags.some((tag) => tags.has(tag));
}

function resolveProductDrivenRows(rows = [], attrs = {}) {
  const source = normalizeProductSource(attrs);
  if (!source) return { source_mode: null, products: [] };
  const byCode = new Map(
    (Array.isArray(rows) ? rows : [])
      .map((row) => [normalizeCode(row?.code), row])
      .filter(([code]) => code)
  );
  const excluded = new Set(source.exclude_product_codes);
  let selected = [];
  if (source.mode === "manual_products") {
    selected = source.product_codes.map((code) => byCode.get(code)).filter(Boolean);
  } else if (source.mode === "product_tag" || source.mode === "collection_or_drop") {
    selected = Array.from(byCode.values()).filter((row) => matchesTag(row, source));
  } else {
    const overrideCodes = [...source.include_product_codes, ...source.product_codes];
    const overrides = overrideCodes.map((code) => byCode.get(code)).filter(Boolean);
    const tagged = Array.from(byCode.values()).filter((row) => matchesTag(row, source));
    selected = [...overrides, ...tagged];
  }
  const seen = new Set();
  const products = selected
    .filter((row) => {
      const code = normalizeCode(row?.code);
      if (!code || excluded.has(code) || seen.has(code)) return false;
      seen.add(code);
      return true;
    })
    .slice(0, source.limit);
  return { source_mode: source.mode, source, products };
}

export {
  PRODUCT_SOURCE_MODES,
  materialTags,
  normalizeProductSource,
  resolveProductDrivenRows
};
