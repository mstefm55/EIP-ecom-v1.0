import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveSocketFieldAliases,
  validateGovernedDropdownValue
} from '../src/services/socket/fieldAliasResolver.js';

function createDb({ aliases = [], manifests = [], schemaRows = [], dropdownRows = [] } = {}) {
  return {
    async query(sql) {
      const text = String(sql);
      if (text.includes('eip_commerce.socket_alias_map')) {
        return { rows: aliases, rowCount: aliases.length };
      }
      if (text.includes('eip_commerce.socket_manifest')) {
        return { rows: manifests, rowCount: manifests.length };
      }
      if (text.includes('eip_core.schema_registry')) {
        return { rows: schemaRows, rowCount: schemaRows.length };
      }
      if (text.includes('eip_core.dropdown_list')) {
        return { rows: dropdownRows, rowCount: dropdownRows.length };
      }
      throw new Error(`Unexpected query: ${text}`);
    }
  };
}

test('tenant FIELD alias has priority over client canonical hint', async () => {
  const db = createDb({
    aliases: [{
      alias_code: 'product.style_name',
      canonical_code: 'product.name',
      attrs: { reviewed: true }
    }]
  });

  const result = await resolveSocketFieldAliases(db, {
    tenantId: 'tenant-1',
    fields: [{ key: 'product.style_name', canonical_hint: 'not.allowed' }],
    allowedCanonicalCodes: ['product.name']
  });

  assert.equal(result.summary.mapped, 1);
  assert.equal(result.fields[0].canonical_code, 'product.name');
  assert.equal(result.fields[0].mapping_source, 'TENANT_ALIAS');
});

test('published socket manifest mapping is reused when no tenant alias exists', async () => {
  const db = createDb({
    manifests: [{
      id: 'manifest-1',
      code: 'WEB',
      version: 3,
      published_at: '2026-09-04T00:00:00Z',
      manifest: {
        mapping: {
          fields: {
            'product.style_name': 'product.name'
          }
        }
      },
      attrs: {}
    }]
  });

  const result = await resolveSocketFieldAliases(db, {
    tenantId: 'tenant-1',
    fields: [{ key: 'product.style_name' }],
    allowedCanonicalCodes: ['product.name'],
    socketCode: 'WEB'
  });

  assert.equal(result.fields[0].status, 'MAPPED');
  assert.equal(result.fields[0].mapping_source, 'SOCKET_MANIFEST');
  assert.equal(result.fields[0].canonical_code, 'product.name');
});

test('client canonical hint is only accepted from caller allowlist', async () => {
  const db = createDb();
  const result = await resolveSocketFieldAliases(db, {
    tenantId: 'tenant-1',
    fields: [
      { key: 'product.style_name', canonical_hint: 'product.name' },
      { key: 'secret.path', canonical_hint: 'eip_core.auth_identity.password_hash' }
    ],
    allowedCanonicalCodes: ['product.name']
  });

  assert.equal(result.fields[0].status, 'MAPPED');
  assert.equal(result.fields[0].mapping_source, 'VALIDATED_CANONICAL_HINT');
  assert.equal(result.fields[1].status, 'UNMAPPED');
  assert.equal(result.fields[1].canonical_code, null);
  assert.equal(result.fields[1].reason, 'CANONICAL_HINT_NOT_APPROVED');
});

test('unmapped fields receive schema-registry candidates for administrator review', async () => {
  const db = createDb({
    schemaRows: [{
      module: 'ecom',
      object_kind: 'material',
      object_type: 'product',
      version: 4,
      tenant_id: null,
      schema_json: {
        type: 'object',
        properties: {
          development_stage: { type: 'string' },
          difficulty: { type: 'string' }
        }
      },
      ui_json: {}
    }]
  });

  const result = await resolveSocketFieldAliases(db, {
    tenantId: 'tenant-1',
    fields: [{
      key: 'product.development_stage',
      canonical_hint: 'attrs.development_stage'
    }],
    allowedCanonicalCodes: ['product.name']
  });

  assert.equal(result.fields[0].status, 'UNMAPPED');
  assert.equal(result.fields[0].schema_suggestions[0].field_path, 'development_stage');
  assert.equal(result.fields[0].schema_suggestions[0].confidence, 1);
});

test('governed dropdown validation uses stable code, not display label', async () => {
  const db = createDb({
    dropdownRows: [{
      code: 'DRESS',
      label: 'Dress',
      list_code: 'GARMENT_CATEGORY',
      module: 'ecom'
    }]
  });
  const ok = await validateGovernedDropdownValue(db, {
    tenantId: 'tenant-1',
    listCode: 'GARMENT_CATEGORY',
    value: 'DRESS'
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.code, 'DRESS');

  const emptyDb = createDb();
  const rejected = await validateGovernedDropdownValue(emptyDb, {
    tenantId: 'tenant-1',
    listCode: 'GARMENT_CATEGORY',
    value: 'Dress'
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.reason, 'DROPDOWN_VALUE_NOT_GOVERNED');
});
