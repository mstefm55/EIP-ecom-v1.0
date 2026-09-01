import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PF_EIP_AUTHORITY,
  applyEipSharedPatch,
  buildEipStarterInput,
  buildPerfectFitIdentity,
  extractPerfectFitSharedMetadata,
  productIntegrationService
} from '../src/lib/productIntegrationService.js';

function richWorkspace() {
  return {
    selectedLocale: 'en',
    projects: [{
      id: 'project-stable-1',
      nodeType: 'project',
      values: { 'project.name': 'Collection', 'project.designer_code': 'PF-COL-001' },
      children: [{
        id: 'style-stable-1',
        nodeType: 'product',
        values: {
          'product.style_name': 'Aurelia',
          'product.style_code': 'PF-COL-001-AUR',
          'product.description': 'PF technical description',
          'product.category': 'DRESS'
        },
        children: [{
          id: 'variant-stable-1',
          nodeType: 'variant',
          values: { 'variant.name': 'Original', 'variant.code': 'PF-COL-001-AUR-V01' },
          children: [
            { id: 'measurements', nodeType: 'sizeSet', values: { body: { bust: 91 }, finished: { bust: 99 }, fitProfile: { ease: 8 }, revisions: [{ id: 'v1' }] }, children: [] },
            { id: 'patterns', nodeType: 'patternLibrary', values: { patterns: [{ id: 'pat-1', reference: 'PAT-001', revisions: [{ id: 'r1', hash: 'abc' }] }] }, children: [] },
            { id: 'fit-session', nodeType: 'projectJournal', values: { fitSessions: [{ id: 'fit-1', notes: 'Keep' }] }, children: [] },
            { id: 'techpack', nodeType: 'techpack', values: { construction: { seam: 'French' } }, children: [] }
          ]
        }]
      }]
    }]
  };
}

test('standalone Perfect Fit remains available when EIP is not configured', async () => {
  assert.equal(productIntegrationService.isConfigured(), false);
  const capability = await productIntegrationService.capability();
  assert.equal(capability.available, false);
  assert.equal(capability.state, 'NOT_AVAILABLE');
});

test('EIP shared patch cannot downgrade rich Perfect Fit technical structures', () => {
  const before = richWorkspace();
  const technicalBefore = structuredClone(before.projects[0].children[0].children[0].children);
  const result = applyEipSharedPatch(before, {
    styleId: 'style-stable-1',
    variantId: 'variant-stable-1',
    patch: {
      product_name: 'Aurelia Enterprise',
      description: 'Lower fidelity EIP description',
      category_code: 'DRESSES',
      currency: 'USD',
      unknown_eip_field: 'ignored'
    },
    link: { eip_product_id: '5f99eb8d-a68f-4a39-8a64-3c4ad06ff829', link_id: 'link-1', status: 'LINKED' }
  });
  const style = result.projects[0].children[0];
  const variant = style.children[0];
  assert.equal(style.values['product.style_name'], 'Aurelia Enterprise');
  assert.equal(style.values['product.description'], 'PF technical description');
  assert.equal(style.values['product.category'], 'DRESS');
  assert.equal(style.values['product.enterprise_category_code'], 'DRESSES');
  assert.equal(style.values['product.currency'], 'USD');
  assert.equal(style.values.unknown_eip_field, undefined);
  assert.deepEqual(variant.children, technicalBefore);
});

test('stable identifiers and explicit authority mapping survive register/link projections', () => {
  const workspace = richWorkspace();
  const project = workspace.projects[0];
  const style = project.children[0];
  const variant = style.children[0];
  const identity = buildPerfectFitIdentity({ project, style, variant });
  assert.equal(identity.pf_product_id, 'variant-stable-1');
  assert.equal(identity.style_code, 'PF-COL-001-AUR');
  assert.equal(identity.variant_code, 'PF-COL-001-AUR-V01');
  assert.deepEqual(identity.pattern_references, ['PAT-001']);
  assert.equal(extractPerfectFitSharedMetadata({ project, style, variant }).description, 'PF technical description');
  assert.equal(PF_EIP_AUTHORITY.description, 'PF_WINS');
  assert.equal(PF_EIP_AUTHORITY.category_code, 'EIP_WINS');
});

test('PF to EIP register payload uses stable identity and only governed shared metadata', () => {
  const workspace = richWorkspace();
  const project = workspace.projects[0];
  const style = project.children[0];
  const variant = style.children[0];
  const identity = buildPerfectFitIdentity({ project, style, variant });
  const shared = extractPerfectFitSharedMetadata({ project, style, variant });
  assert.equal(identity.pf_product_id, 'variant-stable-1');
  assert.equal(identity.variant_id, 'variant-stable-1');
  assert.equal(shared.product_name, 'Aurelia');
  assert.equal(shared.description, 'PF technical description');
  assert.equal(shared.measurement_chart, undefined);
});

test('EIP to existing PF link stores link identity without replacing PF-owned metadata', () => {
  const before = richWorkspace();
  const result = applyEipSharedPatch(before, {
    styleId: 'style-stable-1',
    variantId: 'variant-stable-1',
    patch: { product_name: 'Aurelia Linked', description: 'must not replace PF', category_code: 'EIP_DRESSES' },
    link: { eip_product_id: 'eip-stable-1', link_id: 'link-stable-1', status: 'LINKED' }
  });
  const style = result.projects[0].children[0];
  const variant = style.children[0];
  assert.equal(style.values['product.style_name'], 'Aurelia Linked');
  assert.equal(style.values['product.description'], 'PF technical description');
  assert.equal(variant.integration.eip.productId, 'eip-stable-1');
  assert.equal(variant.integration.eip.linkId, 'link-stable-1');
});

test('shared metadata sync cannot downgrade measurement, mannequin, pattern, journal, or tech-pack state', () => {
  const before = richWorkspace();
  const technicalBefore = structuredClone(before.projects[0].children[0].children[0].children);
  const result = applyEipSharedPatch(before, {
    styleId: 'style-stable-1',
    variantId: 'variant-stable-1',
    patch: { product_name: 'Synced Name', description: '', category_code: 'DRESSES', currency: 'USD' },
    link: { eip_product_id: 'eip-stable-1', link_id: 'link-stable-1', status: 'LINKED' }
  });
  assert.deepEqual(result.projects[0].children[0].children[0].children, technicalBefore);
});

test('EIP-origin starter data creates inputs for a new PF structure without importing an EIP document', () => {
  const starter = buildEipStarterInput({
    id: 'eip-uuid',
    title: 'Enterprise Dress',
    shared_metadata: { product_name: 'Enterprise Dress', category_code: 'DRESSES', currency: 'EUR' },
    attrs: { inventory: { on_hand: 500 }, accounting: { ledger: 'must-not-copy' } }
  });
  assert.equal(starter.style['product.style_name'], 'Enterprise Dress');
  assert.equal(starter.style['product.enterprise_category_code'], 'DRESSES');
  assert.equal(starter.style['product.currency'], 'EUR');
  assert.equal(starter.style.inventory, undefined);
  assert.equal(starter.style.accounting, undefined);
});
