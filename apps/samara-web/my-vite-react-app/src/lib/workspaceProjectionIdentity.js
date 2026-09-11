const normalizeText = (value) => String(value || '').trim();

const isWorkspaceDocument = (value) => Boolean(
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Array.isArray(value.projects)
);

function projectedVariantProductMap(projection = {}) {
  const rows = Array.isArray(projection?.products) ? projection.products : [];
  return new Map(
    rows
      .filter((item) =>
        item?.ok === true &&
        String(item?.entity_level || '').toUpperCase() === 'STYLE_VARIANT' &&
        normalizeText(item?.variant_id) &&
        normalizeText(item?.product_id)
      )
      .map((item) => [normalizeText(item.variant_id), normalizeText(item.product_id)])
  );
}

export function workspaceNeedsProjectionIdentityReconciliation(workspace) {
  if (!isWorkspaceDocument(workspace)) return false;

  for (const project of workspace.projects) {
    if (project?.nodeType !== 'project') continue;
    for (const style of project.children || []) {
      if (style?.nodeType !== 'product') continue;
      for (const variant of style.children || []) {
        if (variant?.nodeType !== 'variant' || !normalizeText(variant?.id)) continue;
        if (!normalizeText(variant?.integration?.eip?.productId)) return true;
      }
    }
  }

  return false;
}

export function applyEnterpriseProjectionProductIds(
  workspace,
  projection,
  { syncedAt = null } = {}
) {
  if (!isWorkspaceDocument(workspace)) {
    return { workspace, changed: false, linkedCount: 0 };
  }

  const productIdByVariantId = projectedVariantProductMap(projection);
  if (!productIdByVariantId.size) {
    return { workspace, changed: false, linkedCount: 0 };
  }

  let changed = false;
  let linkedCount = 0;
  const resolvedSyncTime = syncedAt || new Date().toISOString();

  const projects = workspace.projects.map((project) => {
    if (project?.nodeType !== 'project' || !Array.isArray(project.children)) return project;

    let projectChanged = false;
    const children = project.children.map((style) => {
      if (style?.nodeType !== 'product' || !Array.isArray(style.children)) return style;

      let styleChanged = false;
      const styleChildren = style.children.map((variant) => {
        if (variant?.nodeType !== 'variant') return variant;

        const variantId = normalizeText(variant.id);
        const projectedProductId = productIdByVariantId.get(variantId);
        if (!projectedProductId) return variant;

        const existingEip = variant?.integration?.eip && typeof variant.integration.eip === 'object'
          ? variant.integration.eip
          : {};
        const existingProductId = normalizeText(existingEip.productId);
        if (existingProductId === projectedProductId) return variant;

        changed = true;
        projectChanged = true;
        styleChanged = true;
        linkedCount += 1;

        return {
          ...variant,
          integration: {
            ...(variant.integration || {}),
            eip: {
              ...existingEip,
              productId: projectedProductId,
              status: existingEip.status || 'LINKED',
              lastSyncAt: resolvedSyncTime
            }
          }
        };
      });

      return styleChanged ? { ...style, children: styleChildren } : style;
    });

    return projectChanged ? { ...project, children } : project;
  });

  return {
    workspace: changed ? { ...workspace, projects } : workspace,
    changed,
    linkedCount
  };
}
