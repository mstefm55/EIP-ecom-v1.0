import { registerPerfectFitProduct } from "./productGateway.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function contextValue(context, key) {
  const sources = [
    context?.variant?.values,
    context?.style?.values,
    context?.project?.values
  ];
  for (const source of sources) {
    if (source && Object.prototype.hasOwnProperty.call(source, key)) {
      return source[key];
    }
  }
  return undefined;
}

function mappingAllowsPerfectFitWrite(field) {
  if (field?.status !== "MAPPED") return false;
  const mapping = asObject(field.approved_mapping);
  const direction = normalizeText(mapping.direction || "BOTH").toUpperCase();
  const authority = normalizeText(mapping.authority || field.authority || "PERFECT_FIT").toUpperCase();
  if (direction === "EIP_TO_PF") return false;
  if (authority === "EIP" || authority === "EIP_WINS" || authority === "MANUAL_REVIEW") return false;
  return true;
}

function setNestedValue(target, path, value) {
  const parts = Array.isArray(path)
    ? path.map((item) => normalizeText(item)).filter(Boolean)
    : [];
  if (!parts.length) return;
  let current = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    const child = asObject(current[key]);
    current[key] = { ...child };
    current = current[key];
  }
  current[parts[parts.length - 1]] = value;
}

function buildSharedMetadata(context, manifestFields) {
  const shared = {};
  for (const field of manifestFields) {
    if (!mappingAllowsPerfectFitWrite(field)) continue;
    const value = contextValue(context, field.key);
    if (value === undefined) continue;
    const target = normalizeText(field?.target?.logical_path || field?.approved_mapping?.target);
    if (target === "material.name") shared.product_name = value;
    if (target === "material.attrs.content.summary") shared.description = value;
    if (target === "material.attrs.taxonomy.brand") shared.brand = value;
    if (target === "material.attrs.taxonomy.category_code") shared.category_code = value;
    if (target === "material.attrs.workflow.lifecycle_status") shared.lifecycle_status = value;
    if (target === "material.attrs.workflow.publication_status") shared.publication_status = value;
    if (target === "material.attrs.commercial.currency") shared.currency = value;
  }
  return shared;
}

function buildPerfectFitIdentity(context) {
  const project = context.project || {};
  const style = context.style || {};
  const variant = context.variant || {};
  return {
    pf_product_id: normalizeText(variant.id),
    project_id: normalizeText(project.id) || null,
    style_id: normalizeText(style.id) || null,
    variant_id: normalizeText(variant.id) || null,
    project_code: normalizeText(project?.values?.["project.designer_code"]) || null,
    style_code: normalizeText(style?.values?.["product.style_code"]) || null,
    variant_code: normalizeText(variant?.values?.["variant.code"]) || null,
    pattern_references: (variant.children || [])
      .filter((node) => node?.nodeType === "patternLibrary")
      .flatMap((node) => node?.values?.patterns || [])
      .map((pattern) => normalizeText(pattern?.reference || pattern?.code || pattern?.id))
      .filter(Boolean),
    workspace_url: null
  };
}

function collectVariantContexts(workspace) {
  const contexts = [];
  for (const project of workspace?.projects || []) {
    if (project?.nodeType !== "project") continue;
    for (const style of project.children || []) {
      if (style?.nodeType !== "product") continue;
      for (const variant of style.children || []) {
        if (variant?.nodeType !== "variant") continue;
        contexts.push({ project, style, variant });
      }
    }
  }
  return contexts;
}

async function applyMaterialMappings(client, tenantId, materialId, context, manifestFields) {
  const result = await client.query(
    `SELECT id, name, attrs FROM eip_core.material WHERE tenant_id=$1 AND id=$2 AND material_type='PRODUCT' LIMIT 1`,
    [tenantId, materialId]
  );
  if (!result.rowCount) return { ok: false, error: "PRODUCT_NOT_FOUND" };

  const row = result.rows[0];
  let nextName = row.name;
  const nextAttrs = { ...asObject(row.attrs) };
  const applied = [];
  const skipped = [];

  for (const field of manifestFields) {
    if (!mappingAllowsPerfectFitWrite(field)) continue;
    const value = contextValue(context, field.key);
    if (value === undefined) continue;

    const mapping = asObject(field.approved_mapping);
    const storage = asObject(mapping.storage || field?.target?.storage);
    const kind = normalizeText(storage.kind).toUpperCase();

    if (
      kind === "RELATIONAL_COLUMN" &&
      normalizeText(storage.object_kind) === "material" &&
      normalizeText(storage.field) === "name"
    ) {
      nextName = value === null ? null : String(value);
      applied.push({ key: field.key, target: "material.name" });
      continue;
    }

    if (
      kind === "JSONB_PATH" &&
      normalizeText(storage.object_kind) === "material" &&
      normalizeText(storage.field) === "attrs" &&
      Array.isArray(storage.path) &&
      storage.path.length > 0 &&
      storage.path.length <= 8
    ) {
      setNestedValue(nextAttrs, storage.path, value);
      applied.push({
        key: field.key,
        target: normalizeText(field?.target?.logical_path || mapping.target),
        storage: "material.attrs"
      });
      continue;
    }

    skipped.push({
      key: field.key,
      reason: "UNSUPPORTED_STORAGE_TARGET",
      storage
    });
  }

  nextAttrs.integration = {
    ...asObject(nextAttrs.integration),
    perfect_fit: {
      ...asObject(nextAttrs.integration?.perfect_fit),
      linked: true,
      projection_mode: "MANIFEST_COORDINATOR",
      last_projection_at: new Date().toISOString(),
      pf_product_id: context.variant.id,
      project_id: context.project.id,
      style_id: context.style.id,
      variant_id: context.variant.id
    }
  };

  await client.query(
    `UPDATE eip_core.material SET name=COALESCE($3,name), attrs=$4::jsonb, updated_at=now() WHERE tenant_id=$1 AND id=$2`,
    [tenantId, materialId, nextName, JSON.stringify(nextAttrs)]
  );

  return { ok: true, applied, skipped };
}

export async function projectPerfectFitWorkspace(db, {
  tenantId,
  actorIdentityId,
  workspace,
  coordinatorManifest
}) {
  const manifestFields = Array.isArray(coordinatorManifest?.fields)
    ? coordinatorManifest.fields
    : [];
  const contexts = collectVariantContexts(workspace);
  const products = [];

  for (const context of contexts) {
    const identity = buildPerfectFitIdentity(context);
    if (!identity.pf_product_id) {
      products.push({
        ok: false,
        variant_id: context.variant?.id || null,
        error: "PF_PRODUCT_ID_REQUIRED"
      });
      continue;
    }

    const sharedMetadata = buildSharedMetadata(context, manifestFields);
    if (!normalizeText(sharedMetadata.product_name)) {
      products.push({
        ok: false,
        variant_id: context.variant.id,
        error: "PRODUCT_NAME_UNMAPPED"
      });
      continue;
    }

    try {
      const registered = await registerPerfectFitProduct(db, {
        tenantId,
        actorIdentityId,
        perfectFit: identity,
        sharedMetadata
      });
      if (!registered?.ok) {
        products.push({
          ok: false,
          variant_id: context.variant.id,
          error: registered?.error || "PRODUCT_REGISTRATION_FAILED"
        });
        continue;
      }

      const materialId = registered?.item?.id || registered?.product_id;
      const client = await db.connect();
      try {
        await client.query("BEGIN");
        const applied = await applyMaterialMappings(
          client,
          tenantId,
          materialId,
          context,
          manifestFields
        );
        if (!applied.ok) {
          await client.query("ROLLBACK");
          products.push({
            ok: false,
            variant_id: context.variant.id,
            product_id: materialId,
            error: applied.error
          });
          continue;
        }
        await client.query("COMMIT");
        products.push({
          ok: true,
          variant_id: context.variant.id,
          product_id: materialId,
          reused: registered?.reused === true,
          applied: applied.applied,
          skipped: applied.skipped
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      products.push({
        ok: false,
        variant_id: context.variant.id,
        error: error?.message || String(error)
      });
    }
  }

  const failures = products.filter((item) => !item.ok);
  return {
    ok: failures.length === 0,
    projected_count: products.filter((item) => item.ok).length,
    failed_count: failures.length,
    products
  };
}
