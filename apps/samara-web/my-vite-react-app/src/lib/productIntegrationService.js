import { eipApiAdapter, isEipApiConfigured } from './eipApiAdapter.js';

export const PF_EIP_AUTHORITY = Object.freeze({
  product_name: 'LATEST_ACCEPTED',
  description: 'PF_WINS',
  brand: 'LATEST_ACCEPTED',
  category_code: 'EIP_WINS',
  category_label: 'DERIVED',
  lifecycle_status: 'EIP_WINS',
  publication_status: 'MANUAL_REVIEW',
  currency: 'EIP_WINS'
});

const optionalText = (value) => {
  const text = value === null || value === undefined ? '' : String(value).trim();
  return text || null;
};

export function buildPerfectFitIdentity({ project, style, variant } = {}) {
  return {
    pf_product_id: optionalText(variant?.id),
    project_id: optionalText(project?.id),
    style_id: optionalText(style?.id),
    variant_id: optionalText(variant?.id),
    project_code: optionalText(project?.values?.['project.designer_code']),
    style_code: optionalText(style?.values?.['product.style_code']),
    variant_code: optionalText(variant?.values?.['variant.code']),
    pattern_references: (variant?.children || [])
      .filter((node) => node.nodeType === 'patternLibrary')
      .flatMap((node) => node?.values?.patterns || [])
      .map((pattern) => optionalText(pattern?.reference || pattern?.code || pattern?.id))
      .filter(Boolean),
    workspace_url: typeof window === 'undefined' ? null : `${window.location.origin}${window.location.pathname}`
  };
}

export function extractPerfectFitSharedMetadata({ project, style, variant } = {}) {
  return {
    product_name: optionalText(style?.values?.['product.style_name'] || variant?.values?.['variant.name']),
    description: optionalText(style?.values?.['product.description']),
    brand: optionalText(style?.values?.['product.brand']),
    category_code: optionalText(style?.values?.['product.enterprise_category_code']),
    category_label: null,
    lifecycle_status: optionalText(style?.values?.['product.enterprise_lifecycle_status']),
    publication_status: optionalText(style?.values?.['product.enterprise_publication_status']),
    currency: optionalText(style?.values?.['product.currency'])
  };
}

function updateNode(nodes, nodeId, updater) {
  return (nodes || []).map((node) => {
    if (node.id === nodeId) return updater(node);
    if (!node.children?.length) return node;
    const children = updateNode(node.children, nodeId, updater);
    return children === node.children ? node : { ...node, children };
  });
}

/** Applies only allow-listed shared fields and integration references. Child technical modules are untouched. */
export function applyEipSharedPatch(workspaceData, { styleId, variantId, patch = {}, link = null } = {}) {
  let projects = workspaceData?.projects || [];
  if (styleId) {
    projects = updateNode(projects, styleId, (node) => ({
      ...node,
      values: {
        ...(node.values || {}),
        ...(patch.product_name ? { 'product.style_name': patch.product_name } : {}),
        // product.description is PF_WINS. EIP may report it, but cannot overwrite it here.
        ...(patch.brand ? { 'product.brand': patch.brand } : {}),
        ...(patch.category_code ? { 'product.enterprise_category_code': patch.category_code } : {}),
        ...(patch.lifecycle_status ? { 'product.enterprise_lifecycle_status': patch.lifecycle_status } : {}),
        ...(patch.publication_status ? { 'product.enterprise_publication_status': patch.publication_status } : {}),
        ...(patch.currency ? { 'product.currency': patch.currency } : {})
      }
    }));
  }
  if (variantId && link) {
    projects = updateNode(projects, variantId, (node) => ({
      ...node,
      integration: {
        ...(node.integration || {}),
        eip: {
          productId: link.status === 'NOT_CONNECTED'
            ? null
            : (link.eip_product_id || link.product_id || node.integration?.eip?.productId || null),
          linkId: link.link_id || null,
          status: link.status || 'LINKED',
          lastSyncAt: link.shared_snapshot?.updated_at || new Date().toISOString()
        }
      }
    }));
  }
  return { ...workspaceData, projects };
}

export function buildEipStarterInput(product = {}) {
  const shared = product.shared_metadata || {};
  return {
    project: {
      'project.name': shared.product_name || product.title || 'EIP Product Development',
      'project.season': 'UNASSIGNED'
    },
    style: {
      'product.style_name': shared.product_name || product.title || 'EIP Product',
      'product.description': shared.description || '',
      'product.enterprise_category_code': shared.category_code || '',
      'product.enterprise_lifecycle_status': shared.lifecycle_status || '',
      'product.currency': shared.currency || ''
    },
    variant: { 'variant.name': 'Original' }
  };
}

export const productIntegrationService = Object.freeze({
  isConfigured: isEipApiConfigured,
  async capability() {
    if (!isEipApiConfigured()) return { available: false, state: 'NOT_AVAILABLE' };
    try {
      const result = await eipApiAdapter.getCapability();
      return { ...(result?.capability || {}), state: result?.capability?.available ? 'AVAILABLE' : 'NOT_AVAILABLE' };
    } catch (error) {
      return { available: false, state: error?.status === 401 ? 'NOT_CONNECTED' : 'NOT_AVAILABLE', error };
    }
  },
  listProducts: (query) => eipApiAdapter.listProducts(query),
  getProduct: (productId) => eipApiAdapter.getProduct(productId),
  getIntegration: (productId) => eipApiAdapter.getIntegration(productId),
  register({ project, style, variant }) {
    return eipApiAdapter.registerProduct({
      perfect_fit: buildPerfectFitIdentity({ project, style, variant }),
      shared_metadata: extractPerfectFitSharedMetadata({ project, style, variant })
    });
  },
  link(productId, { project, style, variant }, origin = 'PERFECT_FIT') {
    return eipApiAdapter.linkProduct(productId, {
      perfect_fit: buildPerfectFitIdentity({ project, style, variant }),
      shared_metadata: extractPerfectFitSharedMetadata({ project, style, variant }),
      origin
    });
  },
  sync(productId, { project, style, variant }) {
    return eipApiAdapter.syncProduct(productId, {
      source: 'PERFECT_FIT',
      perfect_fit_shared_metadata: extractPerfectFitSharedMetadata({ project, style, variant })
    });
  },
  unlink: (productId) => eipApiAdapter.unlinkProduct(productId)
});
