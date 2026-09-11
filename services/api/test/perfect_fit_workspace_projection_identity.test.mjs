import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyEnterpriseProjectionProductIds,
  workspaceNeedsProjectionIdentityReconciliation
} from '../../../apps/samara-web/my-vite-react-app/src/lib/workspaceProjectionIdentity.js';

function workspaceFixture() {
  return {
    version: 'test',
    projects: [
      {
        id: 'project-1',
        nodeType: 'project',
        values: {},
        children: [
          {
            id: 'style-1',
            nodeType: 'product',
            values: { 'product.style_name': 'Aurelia' },
            children: [
              {
                id: 'variant-1',
                nodeType: 'variant',
                values: { 'variant.name': 'Original' },
                children: []
              }
            ]
          }
        ]
      }
    ]
  };
}

test('workspace projection writes the governed EIP material UUID onto the matching PF variant', () => {
  const workspace = workspaceFixture();
  const projection = {
    ok: true,
    products: [
      {
        ok: true,
        entity_level: 'STYLE_VARIANT',
        variant_id: 'variant-1',
        product_id: '0a578107-93ee-495e-bd9e-287f127ec120'
      }
    ]
  };

  assert.equal(workspaceNeedsProjectionIdentityReconciliation(workspace), true);

  const result = applyEnterpriseProjectionProductIds(workspace, projection, {
    syncedAt: '2026-09-11T12:00:00.000Z'
  });

  assert.equal(result.changed, true);
  assert.equal(result.linkedCount, 1);
  assert.equal(
    result.workspace.projects[0].children[0].children[0].integration.eip.productId,
    '0a578107-93ee-495e-bd9e-287f127ec120'
  );
  assert.equal(
    result.workspace.projects[0].children[0].children[0].integration.eip.status,
    'LINKED'
  );
  assert.equal(
    result.workspace.projects[0].children[0].children[0].integration.eip.lastSyncAt,
    '2026-09-11T12:00:00.000Z'
  );
  assert.equal(workspaceNeedsProjectionIdentityReconciliation(result.workspace), false);

  // The helper is immutable: the private source snapshot is not modified in place.
  assert.equal(workspace.projects[0].children[0].children[0].integration, undefined);
});

test('failed or unrelated projections never manufacture an EIP material identity', () => {
  const workspace = workspaceFixture();
  const projection = {
    ok: false,
    products: [
      {
        ok: false,
        entity_level: 'STYLE_VARIANT',
        variant_id: 'variant-1',
        product_id: '11111111-1111-4111-8111-111111111111'
      },
      {
        ok: true,
        entity_level: 'STYLE_VARIANT',
        variant_id: 'different-variant',
        product_id: '22222222-2222-4222-8222-222222222222'
      }
    ]
  };

  const result = applyEnterpriseProjectionProductIds(workspace, projection);
  assert.equal(result.changed, false);
  assert.equal(result.linkedCount, 0);
  assert.equal(result.workspace, workspace);
  assert.equal(workspaceNeedsProjectionIdentityReconciliation(result.workspace), true);
});

test('an existing EIP product identity is preserved when projection returns the same material', () => {
  const workspace = workspaceFixture();
  workspace.projects[0].children[0].children[0].integration = {
    eip: {
      productId: '33333333-3333-4333-8333-333333333333',
      status: 'LINKED',
      lastSyncAt: '2026-09-10T12:00:00.000Z'
    }
  };

  const projection = {
    ok: true,
    products: [
      {
        ok: true,
        entity_level: 'STYLE_VARIANT',
        variant_id: 'variant-1',
        product_id: '33333333-3333-4333-8333-333333333333'
      }
    ]
  };

  const result = applyEnterpriseProjectionProductIds(workspace, projection);
  assert.equal(result.changed, false);
  assert.equal(result.linkedCount, 0);
  assert.equal(result.workspace, workspace);
  assert.equal(workspaceNeedsProjectionIdentityReconciliation(workspace), false);
});
