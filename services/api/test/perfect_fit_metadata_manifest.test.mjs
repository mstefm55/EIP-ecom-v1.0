import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPerfectFitMetadataBundle } from '../src/services/perfectFit/metadataManifest.js';

function buildDb() {
  return {
    async query(sql, params) {
      const text = String(sql);
      if (text.includes('FROM eip_commerce.socket_manifest')) {
        assert.equal(params[0], 'tenant-1');
        return {
          rowCount: 1,
          rows: [{
            id: 'manifest-1',
            code: 'PERFECT_FIT',
            version: 3,
            published_at: '2026-09-05T00:00:00.000Z',
            updated_at: '2026-09-05T00:00:00.000Z',
            attrs: { application: 'perfect_fit' },
            manifest: {
              application: 'perfect_fit',
              workspace: {
                version: 'db-v3',
                dropdownBindings: {
                  VARIANT_STATUS: 'PF_VARIANT_STATUS'
                },
                fields: {
                  'variant.status': {
                    key: 'variant.status',
                    type: 'select',
                    governanceList: 'VARIANT_STATUS',
                    usedAsEipParameter: true
                  }
                },
                fieldGroups: {
                  variantIdentity: { fields: ['variant.status'] }
                },
                structure: {
                  rootType: 'workspace',
                  productHierarchy: {
                    levels: [
                      { level: 'STYLE', nodeType: 'product', parentLevel: 'PROJECT' },
                      { level: 'STYLE_VARIANT', nodeType: 'variant', parentLevel: 'STYLE' },
                      { level: 'SIZE_VARIANT', nodeType: 'measurement_chart_size', parentLevel: 'STYLE_VARIANT' }
                    ]
                  },
                  treeTypes: {
                    project: { children: ['product'] },
                    product: { children: ['variant'] },
                    variant: { children: ['sizeSet'] },
                    sizeSet: { children: [] }
                  }
                },
                referenceConvention: {
                  styleCodeField: 'product.style_code',
                  variantCodeField: 'variant.code'
                }
              }
            }
          }]
        };
      }

      if (text.includes('FROM eip_core.dropdown_list')) {
        assert.deepEqual(params[0], ['PF_VARIANT_STATUS']);
        return {
          rowCount: 2,
          rows: [
            {
              id: 'list-1',
              list_code: 'PF_VARIANT_STATUS',
              module: 'perfect_fit',
              version: 1,
              tenant_id: 'tenant-1',
              value_code: 'DEVELOPMENT',
              value_label: 'In development',
              sort_order: 10,
              value_attrs: {}
            },
            {
              id: 'list-1',
              list_code: 'PF_VARIANT_STATUS',
              module: 'perfect_fit',
              version: 1,
              tenant_id: 'tenant-1',
              value_code: 'APPROVED',
              value_label: 'Approved',
              sort_order: 20,
              value_attrs: {}
            }
          ]
        };
      }

      throw new Error(`Unexpected query: ${text}`);
    }
  };
}

test('published Perfect Fit manifest and dropdowns become the runtime metadata authority', async () => {
  const bundle = await loadPerfectFitMetadataBundle(buildDb(), {
    tenantId: 'tenant-1',
    socketCode: 'WEB',
    connectionCode: 'SAMARA_WEB'
  });

  assert.equal(bundle.ok, true);
  assert.equal(bundle.source.authority, 'EIP_DB');
  assert.equal(bundle.source.manifest_code, 'PERFECT_FIT');
  assert.equal(bundle.runtime_metadata.workspace.metadataAuthority.source, 'EIP_DB');
  assert.deepEqual(
    bundle.runtime_metadata.workspace.dropdowns.VARIANT_STATUS.map((item) => item.code),
    ['DEVELOPMENT', 'APPROVED']
  );
  assert.equal(
    bundle.contract.fields[0].governance_list,
    'PF_VARIANT_STATUS'
  );
  assert.equal(bundle.contract.fields[0].canonical_hint, null);
  assert.equal(bundle.contract.dropdowns[0].code, 'PF_VARIANT_STATUS');
  assert.equal(bundle.contract.dropdowns[0].logical_code, 'VARIANT_STATUS');
  assert.equal(bundle.contract.structure.product_hierarchy.levels.length, 3);
});

test('missing published Perfect Fit manifest is explicit and never synthesized from frontend metadata', async () => {
  const db = {
    async query(sql) {
      if (String(sql).includes('FROM eip_commerce.socket_manifest')) {
        return { rowCount: 0, rows: [] };
      }
      throw new Error('dropdown query must not execute without manifest');
    }
  };

  const bundle = await loadPerfectFitMetadataBundle(db, { tenantId: 'tenant-1' });
  assert.equal(bundle.ok, false);
  assert.equal(bundle.error, 'PERFECT_FIT_METADATA_MANIFEST_NOT_PUBLISHED');
});
