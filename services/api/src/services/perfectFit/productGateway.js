import { randomUUID } from "node:crypto";
import {
  PERFECT_FIT_LINK_RECORD_TYPE,
  PERFECT_FIT_LINK_RELATION,
  PERFECT_FIT_SHARED_FIELD_POLICIES,
  PERFECT_FIT_STYLE_VARIANT_RELATION,
  buildPerfectFitLinkPayload,
  extractEipSharedMetadata,
  normalizePerfectFitIdentity,
  normalizeSharedMetadata,
  reconcileSharedMetadata
} from "../../lib/perfectFitProductIntegration.js";

const MATERIAL_TYPE = "PRODUCT";
const PRODUCT_LEVEL_STYLE_MASTER = "STYLE_MASTER";
const PRODUCT_LEVEL_STYLE_VARIANT = "STYLE_VARIANT";

function normalizeProductLevel(value, identity = {}) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === PRODUCT_LEVEL_STYLE_MASTER || normalized === "STYLE") {
    return PRODUCT_LEVEL_STYLE_MASTER;
  }
  if (normalized === PRODUCT_LEVEL_STYLE_VARIANT || normalized === "VARIANT") {
    return PRODUCT_LEVEL_STYLE_VARIANT;
  }
  return identity.entity_level === "STYLE" ? PRODUCT_LEVEL_STYLE_MASTER : PRODUCT_LEVEL_STYLE_VARIANT;
}

async function generateProductCode(client, tenantId) {
  const prefix = "PRD";
  for (let i = 0; i < 6; i += 1) {
    const candidate = `${prefix}-${randomUUID().split("-")[0].toUpperCase()}`;
    // eslint-disable-next-line no-await-in-loop
    const result = await client.query(
      `SELECT 1 FROM eip_core.material WHERE tenant_id=$1 AND code=$2 LIMIT 1`,
      [tenantId, candidate]
    );
    if (result.rowCount === 0) return candidate;
  }
  return `${prefix}-${Date.now().toString(36).toUpperCase()}`;
}

async function ensureStyleVariantHierarchyLink(client, {
  tenantId,
  parentProductId,
  childProductId
}) {
  if (!parentProductId || !childProductId) return null;
  if (String(parentProductId) === String(childProductId)) {
    return { ok: false, error: "STYLE_VARIANT_PARENT_INVALID" };
  }

  const parent = await client.query(
    `SELECT id FROM eip_core.material
     WHERE tenant_id=$1 AND id=$2 AND material_type=$3 LIMIT 1`,
    [tenantId, parentProductId, MATERIAL_TYPE]
  );
  if (!parent.rowCount) return { ok: false, error: "STYLE_MASTER_NOT_FOUND" };

  const existing = await client.query(
    `SELECT id
     FROM eip_core.object_link
     WHERE tenant_id=$1
       AND src_kind='material'
       AND src_id=$2
       AND dst_kind='material'
       AND dst_id=$3
       AND relation_type=$4
       AND is_active=true
     LIMIT 1`,
    [tenantId, childProductId, parentProductId, PERFECT_FIT_STYLE_VARIANT_RELATION]
  );
  if (existing.rowCount) {
    return { ok: true, reused: true, link_id: existing.rows[0].id };
  }

  const link = await client.query(
    `INSERT INTO eip_core.object_link
      (tenant_id, src_kind, src_id, dst_kind, dst_id, relation_type, attrs)
     VALUES ($1,'material',$2,'material',$3,$4,$5::jsonb)
     RETURNING id`,
    [
      tenantId,
      childProductId,
      parentProductId,
      PERFECT_FIT_STYLE_VARIANT_RELATION,
      JSON.stringify({
        authority: "PERFECT_FIT_PRODUCT_DEVELOPMENT",
        hierarchy_level: PRODUCT_LEVEL_STYLE_VARIANT,
        delete_behavior: "UNLINK_ONLY"
      })
    ]
  );
  return { ok: true, reused: false, link_id: link.rows[0]?.id || null };
}

export async function loadPerfectFitProductLink(client, tenantId, materialId) {
  const result = await client.query(
    `
    SELECT ol.id AS link_id,
           ol.attrs AS link_attrs,
           ol.created_at AS link_created_at,
           ol.updated_at AS link_updated_at,
           ir.id AS info_record_id,
           ir.payload,
           ir.created_at,
           ir.updated_at
    FROM eip_core.object_link ol
    JOIN eip_core.info_record ir
      ON ir.tenant_id = ol.tenant_id
     AND ir.id = ol.dst_id
     AND ir.record_type = $5
     AND ir.is_active = true
    WHERE ol.tenant_id = $1
      AND ol.src_kind = $2
      AND ol.src_id = $3
      AND ol.dst_kind = $4
      AND ol.relation_type = $6
      AND ol.is_active = true
    ORDER BY ol.updated_at DESC
    LIMIT 1
    `,
    [tenantId, "material", materialId, "info_record", PERFECT_FIT_LINK_RECORD_TYPE, PERFECT_FIT_LINK_RELATION]
  );
  return result.rows[0] || null;
}

export function serializePerfectFitLink(row) {
  if (!row) return null;
  return {
    link_id: row.link_id,
    info_record_id: row.info_record_id,
    ...(row.payload && typeof row.payload === "object" ? row.payload : {}),
    created_at: row.created_at || row.link_created_at || null,
    updated_at: row.updated_at || row.link_updated_at || null
  };
}

async function attachPerfectFitProductLink(client, {
  tenantId,
  materialId,
  identity,
  sharedMetadata,
  origin,
  actorIdentityId
}) {
  const duplicate = await client.query(
    `
    SELECT ir.id, ol.src_id AS material_id
    FROM eip_core.info_record ir
    JOIN eip_core.object_link ol
      ON ol.tenant_id = ir.tenant_id
     AND ol.dst_kind = 'info_record'
     AND ol.dst_id = ir.id
     AND ol.relation_type = $3
     AND ol.is_active = true
    WHERE ir.tenant_id = $1
      AND ir.record_type = $2
      AND ir.is_active = true
      AND ir.payload->'perfect_fit'->>'pf_product_id' = $4
    LIMIT 1
    `,
    [tenantId, PERFECT_FIT_LINK_RECORD_TYPE, PERFECT_FIT_LINK_RELATION, identity.pf_product_id]
  );
  if (duplicate.rowCount && String(duplicate.rows[0].material_id) !== String(materialId)) {
    return { ok: false, status: 409, error: "PERFECT_FIT_PRODUCT_ALREADY_LINKED" };
  }

  const existing = await loadPerfectFitProductLink(client, tenantId, materialId);
  if (existing) {
    const existingPfId = existing.payload?.perfect_fit?.pf_product_id;
    if (existingPfId && existingPfId !== identity.pf_product_id) {
      return { ok: false, status: 409, error: "EIP_PRODUCT_ALREADY_LINKED" };
    }
    const payload = buildPerfectFitLinkPayload({
      identity,
      sharedMetadata,
      origin,
      actorIdentityId,
      existing: existing.payload || {}
    });
    await client.query(
      `UPDATE eip_core.info_record SET title=$3, payload=$4::jsonb, updated_at=now()
       WHERE tenant_id=$1 AND id=$2`,
      [tenantId, existing.info_record_id, identity.style_code || identity.variant_code || identity.pf_product_id, JSON.stringify(payload)]
    );
    return { ok: true, link: serializePerfectFitLink({ ...existing, payload }) };
  }

  const payload = buildPerfectFitLinkPayload({ identity, sharedMetadata, origin, actorIdentityId });
  const info = await client.query(
    `
    INSERT INTO eip_core.info_record (tenant_id, record_type, title, payload, attrs)
    VALUES ($1,$2,$3,$4::jsonb,$5::jsonb)
    RETURNING id, created_at, updated_at
    `,
    [
      tenantId,
      PERFECT_FIT_LINK_RECORD_TYPE,
      identity.style_code || identity.variant_code || identity.pf_product_id,
      JSON.stringify(payload),
      JSON.stringify({ authority: "PERFECT_FIT_PRODUCT_DEVELOPMENT", contains_private_technical_data: false })
    ]
  );
  const link = await client.query(
    `
    INSERT INTO eip_core.object_link
      (tenant_id, src_kind, src_id, dst_kind, dst_id, relation_type, attrs)
    VALUES ($1,'material',$2,'info_record',$3,$4,$5::jsonb)
    RETURNING id, created_at, updated_at
    `,
    [
      tenantId,
      materialId,
      info.rows[0].id,
      PERFECT_FIT_LINK_RELATION,
      JSON.stringify({ delete_behavior: "UNLINK_ONLY", perfect_fit_private_data_access: false })
    ]
  );
  return {
    ok: true,
    link: serializePerfectFitLink({
      link_id: link.rows[0].id,
      info_record_id: info.rows[0].id,
      payload,
      created_at: info.rows[0].created_at,
      updated_at: info.rows[0].updated_at
    })
  };
}

async function withTransaction(db, operation) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    if (result?.ok === false) {
      await client.query("ROLLBACK");
      return result;
    }
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listPerfectFitProducts(db, { tenantId, query = "", limit = 100 }) {
  const normalizedQuery = String(query || "").trim();
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 100);
  const result = await db.query(
    `
    SELECT id, code, name AS title, attrs, created_at, updated_at
    FROM eip_core.material
    WHERE tenant_id=$1
      AND material_type=$2
      AND ($3 = '' OR code ILIKE '%' || $3 || '%' OR name ILIKE '%' || $3 || '%')
    ORDER BY updated_at DESC, name ASC
    LIMIT $4
    `,
    [tenantId, MATERIAL_TYPE, normalizedQuery, safeLimit]
  );
  return result.rows.map((row) => ({
    id: row.id,
    code: row.code,
    title: row.title,
    product_level: row.attrs?.product_hierarchy?.level || null,
    shared_metadata: extractEipSharedMetadata(row),
    created_at: row.created_at,
    updated_at: row.updated_at
  }));
}

export async function getPerfectFitProduct(db, { tenantId, productId }) {
  const product = await db.query(
    `SELECT id, code, name AS title, attrs, created_at, updated_at
     FROM eip_core.material
     WHERE tenant_id=$1 AND id=$2 AND material_type=$3`,
    [tenantId, productId, MATERIAL_TYPE]
  );
  if (!product.rowCount) return { ok: false, status: 404, error: "NOT_FOUND" };
  const row = product.rows[0];
  return {
    ok: true,
    product: {
      id: row.id,
      code: row.code,
      title: row.title,
      product_level: row.attrs?.product_hierarchy?.level || null,
      shared_metadata: extractEipSharedMetadata(row),
      created_at: row.created_at,
      updated_at: row.updated_at
    }
  };
}

export async function getPerfectFitIntegration(db, { tenantId, productId }) {
  const product = await getPerfectFitProduct(db, { tenantId, productId });
  if (!product.ok) return product;
  const link = await loadPerfectFitProductLink(db, tenantId, productId);
  return {
    ok: true,
    product: product.product,
    link: serializePerfectFitLink(link),
    shared_field_policies: PERFECT_FIT_SHARED_FIELD_POLICIES
  };
}

export async function linkPerfectFitProduct(db, {
  tenantId,
  productId,
  actorIdentityId,
  perfectFit,
  sharedMetadata,
  origin
}) {
  const normalized = normalizePerfectFitIdentity(perfectFit);
  if (!normalized.ok) return { ...normalized, status: 400 };
  return withTransaction(db, async (client) => {
    const material = await client.query(
      `SELECT id, code, name AS title, attrs FROM eip_core.material
       WHERE tenant_id=$1 AND id=$2 AND material_type=$3 FOR UPDATE`,
      [tenantId, productId, MATERIAL_TYPE]
    );
    if (!material.rowCount) return { ok: false, status: 404, error: "NOT_FOUND" };
    const shared = normalizeSharedMetadata({
      ...extractEipSharedMetadata(material.rows[0]),
      ...(sharedMetadata || {})
    });
    return attachPerfectFitProductLink(client, {
      tenantId,
      materialId: productId,
      identity: normalized.identity,
      sharedMetadata: shared,
      origin: origin || "LINKED",
      actorIdentityId
    });
  });
}

export async function registerPerfectFitProduct(db, {
  tenantId,
  actorIdentityId,
  perfectFit,
  sharedMetadata,
  hierarchy = null
}) {
  const normalized = normalizePerfectFitIdentity(perfectFit);
  if (!normalized.ok) return { ...normalized, status: 400 };
  const shared = normalizeSharedMetadata(sharedMetadata);
  if (!shared.product_name) return { ok: false, status: 400, error: "PRODUCT_NAME_REQUIRED" };
  const hierarchyLevel = normalizeProductLevel(hierarchy?.level, normalized.identity);
  const parentProductId = hierarchyLevel === PRODUCT_LEVEL_STYLE_VARIANT
    ? hierarchy?.parent_product_id || hierarchy?.parentProductId || null
    : null;

  return withTransaction(db, async (client) => {
    const existing = await client.query(
      `SELECT ol.src_id AS material_id
       FROM eip_core.info_record ir
       JOIN eip_core.object_link ol ON ol.tenant_id=ir.tenant_id AND ol.dst_id=ir.id
       WHERE ir.tenant_id=$1 AND ir.record_type=$2 AND ir.is_active=true
         AND ol.relation_type=$3 AND ol.is_active=true
         AND ir.payload->'perfect_fit'->>'pf_product_id'=$4 LIMIT 1`,
      [tenantId, PERFECT_FIT_LINK_RECORD_TYPE, PERFECT_FIT_LINK_RELATION, normalized.identity.pf_product_id]
    );
    if (existing.rowCount) {
      const productId = existing.rows[0].material_id;
      await client.query(
        `UPDATE eip_core.material
         SET attrs = jsonb_set(
               COALESCE(attrs, '{}'::jsonb),
               '{product_hierarchy,level}',
               to_jsonb($3::text),
               true
             ),
             updated_at=now()
         WHERE tenant_id=$1 AND id=$2 AND material_type=$4`,
        [tenantId, productId, hierarchyLevel, MATERIAL_TYPE]
      );
      let hierarchyLink = null;
      if (parentProductId) {
        hierarchyLink = await ensureStyleVariantHierarchyLink(client, {
          tenantId,
          parentProductId,
          childProductId: productId
        });
        if (hierarchyLink?.ok === false) return hierarchyLink;
      }
      return {
        ok: true,
        reused: true,
        product_id: productId,
        product_level: hierarchyLevel,
        hierarchy_link: hierarchyLink
      };
    }

    const code = await generateProductCode(client, tenantId);
    const attrs = {
      content: { summary: shared.description },
      taxonomy: { brand: shared.brand },
      workflow: { integration_origin: "PERFECT_FIT" },
      product_hierarchy: { level: hierarchyLevel },
      integration: { perfect_fit: { registered_at: new Date().toISOString() } }
    };
    const material = await client.query(
      `INSERT INTO eip_core.material (tenant_id, material_type, code, name, attrs)
       VALUES ($1,$2,$3,$4,$5::jsonb)
       RETURNING id, code, name AS title, attrs, created_at, updated_at`,
      [tenantId, MATERIAL_TYPE, code, shared.product_name, JSON.stringify(attrs)]
    );
    const attached = await attachPerfectFitProductLink(client, {
      tenantId,
      materialId: material.rows[0].id,
      identity: normalized.identity,
      sharedMetadata: shared,
      origin: "PERFECT_FIT",
      actorIdentityId
    });
    if (!attached.ok) return attached;

    let hierarchyLink = null;
    if (parentProductId) {
      hierarchyLink = await ensureStyleVariantHierarchyLink(client, {
        tenantId,
        parentProductId,
        childProductId: material.rows[0].id
      });
      if (hierarchyLink?.ok === false) return hierarchyLink;
    }

    return {
      ok: true,
      status: 201,
      item: material.rows[0],
      product_level: hierarchyLevel,
      hierarchy_link: hierarchyLink,
      link: attached.link
    };
  });
}

function normalizeSizeVariantRows(sizeVariants = []) {
  return (Array.isArray(sizeVariants) ? sizeVariants : [])
    .map((item, index) => {
      const sourceId = String(item?.id || item?.code || `size-${index + 1}`).trim();
      const size = String(item?.size || item?.label || item?.code || sourceId).trim();
      if (!sourceId || !size) return null;
      return {
        id: `pf:${sourceId}`,
        size,
        active: item?.active !== false,
        stock_qty: null,
        price_delta: null,
        hasData: true
      };
    })
    .filter(Boolean);
}

export async function syncPerfectFitSizeVariants(db, {
  tenantId,
  productId,
  sizeVariants
}) {
  const incoming = normalizeSizeVariantRows(sizeVariants);
  return withTransaction(db, async (client) => {
    const material = await client.query(
      `SELECT id, attrs
       FROM eip_core.material
       WHERE tenant_id=$1 AND id=$2 AND material_type=$3
       FOR UPDATE`,
      [tenantId, productId, MATERIAL_TYPE]
    );
    if (!material.rowCount) return { ok: false, status: 404, error: "NOT_FOUND" };

    const attrs = material.rows[0].attrs && typeof material.rows[0].attrs === "object"
      ? { ...material.rows[0].attrs }
      : {};
    const variants = attrs.variants && typeof attrs.variants === "object"
      ? { ...attrs.variants }
      : {};
    const headers = Array.isArray(variants.headers) ? [...variants.headers] : [];
    if (!headers.some((header) => String(header?.key || "").toLowerCase() === "size")) {
      headers.unshift({ key: "size", label: "Size" });
    }

    const existingItems = Array.isArray(variants.items) ? [...variants.items] : [];
    const existingById = new Map(existingItems.map((item) => [String(item?.id || ""), item]));
    const incomingIds = new Set(incoming.map((item) => item.id));
    const mergedPfItems = incoming.map((item) => {
      const previous = existingById.get(item.id) || {};
      return {
        ...previous,
        ...item,
        stock_qty: previous.stock_qty ?? item.stock_qty,
        price_delta: previous.price_delta ?? item.price_delta,
        active: previous.active === false ? false : item.active
      };
    });
    const preservedEipItems = existingItems.filter((item) => !incomingIds.has(String(item?.id || "")));

    attrs.variants = {
      ...variants,
      enabled: incoming.length > 0 || variants.enabled === true,
      headers,
      items: [...mergedPfItems, ...preservedEipItems]
    };

    await client.query(
      `UPDATE eip_core.material SET attrs=$3::jsonb, updated_at=now()
       WHERE tenant_id=$1 AND id=$2`,
      [tenantId, productId, JSON.stringify(attrs)]
    );

    return {
      ok: true,
      product_id: productId,
      synced_size_count: incoming.length,
      preserved_eip_variant_count: preservedEipItems.length
    };
  });
}

export async function syncPerfectFitProduct(db, {
  tenantId,
  productId,
  actorIdentityId,
  source,
  perfectFitSharedMetadata,
  resolutions
}) {
  return withTransaction(db, async (client) => {
    const material = await client.query(
      `SELECT id, code, name AS title, attrs FROM eip_core.material
       WHERE tenant_id=$1 AND id=$2 AND material_type=$3 FOR UPDATE`,
      [tenantId, productId, MATERIAL_TYPE]
    );
    if (!material.rowCount) return { ok: false, status: 404, error: "NOT_FOUND" };
    const linkRow = await loadPerfectFitProductLink(client, tenantId, productId);
    if (!linkRow) return { ok: false, status: 409, error: "PERFECT_FIT_NOT_LINKED" };
    const payload = linkRow.payload || {};
    const pfShared = normalizeSharedMetadata(
      perfectFitSharedMetadata || payload?.shared_snapshot?.perfect_fit || payload?.shared_snapshot?.accepted || {}
    );
    const eipShared = extractEipSharedMetadata(material.rows[0]);
    const reconciled = reconcileSharedMetadata({
      source,
      eip: eipShared,
      perfectFit: pfShared,
      lastAccepted: payload?.shared_snapshot?.accepted || {},
      resolutions: resolutions || {}
    });
    const nextAttrs = { ...(material.rows[0].attrs || {}) };
    nextAttrs.content = { ...(nextAttrs.content || {}), summary: reconciled.patch_to_eip.description };
    nextAttrs.taxonomy = { ...(nextAttrs.taxonomy || {}) };
    if (reconciled.patch_to_eip.brand) nextAttrs.taxonomy.brand = reconciled.patch_to_eip.brand;
    nextAttrs.integration = {
      ...(nextAttrs.integration || {}),
      perfect_fit: {
        ...(nextAttrs.integration?.perfect_fit || {}),
        linked: true,
        last_sync_at: new Date().toISOString(),
        last_sync_source: source,
        conflicts: reconciled.conflicts.map((item) => item.field)
      }
    };
    await client.query(
      `UPDATE eip_core.material SET name=COALESCE($3,name), attrs=$4::jsonb, updated_at=now()
       WHERE tenant_id=$1 AND id=$2`,
      [tenantId, productId, reconciled.patch_to_eip.product_name, JSON.stringify(nextAttrs)]
    );
    const nextPayload = {
      ...payload,
      shared_snapshot: {
        ...(payload.shared_snapshot || {}),
        perfect_fit: pfShared,
        eip: eipShared,
        accepted: reconciled.accepted,
        conflicts: reconciled.conflicts,
        unmapped_fields: reconciled.unmapped_fields,
        updated_at: new Date().toISOString(),
        updated_by_identity_id: actorIdentityId
      },
      updated_at: new Date().toISOString()
    };
    await client.query(
      `UPDATE eip_core.info_record SET payload=$3::jsonb, updated_at=now()
       WHERE tenant_id=$1 AND id=$2`,
      [tenantId, linkRow.info_record_id, JSON.stringify(nextPayload)]
    );
    return {
      ok: true,
      patch_to_perfect_fit: reconciled.patch_to_perfect_fit,
      conflicts: reconciled.conflicts,
      unmapped_fields: reconciled.unmapped_fields,
      shared_field_policies: PERFECT_FIT_SHARED_FIELD_POLICIES,
      link: serializePerfectFitLink({ ...linkRow, payload: nextPayload })
    };
  });
}

export async function unlinkPerfectFitProduct(db, { tenantId, productId }) {
  return withTransaction(db, async (client) => {
    const link = await loadPerfectFitProductLink(client, tenantId, productId);
    if (!link) return { ok: true, unlinked: false, records_deleted: false };
    await client.query(
      `UPDATE eip_core.object_link SET is_active=false, updated_at=now()
       WHERE tenant_id=$1 AND id=$2`,
      [tenantId, link.link_id]
    );
    await client.query(
      `UPDATE eip_core.info_record SET is_active=false, updated_at=now()
       WHERE tenant_id=$1 AND id=$2`,
      [tenantId, link.info_record_id]
    );
    return { ok: true, unlinked: true, records_deleted: false };
  });
}

export {
  PERFECT_FIT_SHARED_FIELD_POLICIES,
  PRODUCT_LEVEL_STYLE_MASTER,
  PRODUCT_LEVEL_STYLE_VARIANT
};
