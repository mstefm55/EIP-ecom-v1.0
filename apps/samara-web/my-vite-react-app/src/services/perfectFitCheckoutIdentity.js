const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeText = (value) => String(value || '').trim();

export function normalizePerfectFitOrderLine(line = {}) {
  const quantity = Math.max(Number(line.quantity) || 1, 1);
  const explicitMaterialId = normalizeText(line.material_id || line.materialId);
  const suppliedMaterialCode = normalizeText(line.material_code || line.materialCode || line.code);

  if (explicitMaterialId) {
    return {
      material_id: explicitMaterialId,
      quantity
    };
  }

  // The EIP public-commerce order contract accepts material_id separately from
  // material_code. When PF is carrying the linked EIP PRODUCT UUID, preserve
  // that identity instead of asking EIP to interpret the UUID as a code.
  if (UUID_RE.test(suppliedMaterialCode)) {
    return {
      material_id: suppliedMaterialCode,
      quantity
    };
  }

  return {
    material_code: suppliedMaterialCode,
    quantity
  };
}

export function normalizePerfectFitOrderPayload(payload = {}) {
  if (!Array.isArray(payload?.line_items)) return payload;
  return {
    ...payload,
    line_items: payload.line_items.map(normalizePerfectFitOrderLine)
  };
}
