import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const route = readFileSync(
  new URL('../src/routes/public_perfect_fit_workspace.js', import.meta.url),
  'utf8'
);
const projection = readFileSync(
  new URL('../src/services/perfectFit/workspaceProductProjection.js', import.meta.url),
  'utf8'
);
const resolver = readFileSync(
  new URL('../src/services/socket/fieldAliasResolver.js', import.meta.url),
  'utf8'
);
const manifestAudit = readFileSync(
  new URL('../src/services/perfectFit/manifestCompleteness.js', import.meta.url),
  'utf8'
);
const productGateway = readFileSync(
  new URL('../src/services/perfectFit/productGateway.js', import.meta.url),
  'utf8'
);
const contract = readFileSync(
  new URL('../../../apps/samara-web/my-vite-react-app/src/lib/perfectFitFieldContract.js', import.meta.url),
  'utf8'
);

test('lossless workspace commit happens before manifest audit and enterprise projection', () => {
  const commitIndex = route.indexOf('await client.query("COMMIT")');
  const auditIndex = route.indexOf('auditPerfectFitManifestCompleteness(app.db');
  const projectionIndex = route.indexOf('projectPerfectFitWorkspaceProducts(app.db');
  assert.ok(commitIndex > 0);
  assert.ok(auditIndex > commitIndex);
  assert.ok(projectionIndex > auditIndex);
  assert.match(route, /Projection failure is reported but never rolls back/);
});

test('PF projection reuses socket resolver and existing product gateway', () => {
  assert.match(projection, /resolveSocketFieldAliases/);
  assert.match(projection, /registerPerfectFitProduct/);
  assert.match(projection, /syncPerfectFitProduct/);
  assert.match(projection, /syncPerfectFitSizeVariants/);
  assert.doesNotMatch(projection, /INSERT\s+INTO\s+eip_core\.material/i);
  assert.doesNotMatch(projection, /UPDATE\s+eip_core\.material/i);
  assert.doesNotMatch(projection, /eip_core\.ui_surface/);
});

test('PF product hierarchy preserves Style, Style Variant, and existing size-variant level', () => {
  assert.match(projection, /collectStyleContexts/);
  assert.match(projection, /entity_level:\s*"STYLE"/);
  assert.match(projection, /entity_level:\s*"STYLE_VARIANT"/);
  assert.match(projection, /level:\s*"STYLE_MASTER"/);
  assert.match(projection, /level:\s*"STYLE_VARIANT"/);
  assert.match(projection, /relation_type:\s*"STYLE_VARIANT_OF"/);
  assert.match(projection, /node\?\.nodeType === "sizeSet"/);
  assert.doesNotMatch(projection, /collectVariantContexts/);

  assert.match(productGateway, /PERFECT_FIT_STYLE_VARIANT_RELATION/);
  assert.match(productGateway, /STYLE_VARIANT_OF/);
  assert.match(productGateway, /product_hierarchy/);
  assert.match(productGateway, /attrs\.variants/);
  assert.match(productGateway, /headers/);
  assert.match(productGateway, /items/);
});

test('generic resolver uses existing SmartSocket and dropdown governance tables', () => {
  assert.match(resolver, /eip_commerce\.socket_alias_map/);
  assert.match(resolver, /eip_commerce\.socket_manifest/);
  assert.match(resolver, /eip_core\.dropdown_list/);
  assert.match(resolver, /eip_core\.dropdown_value/);
  assert.doesNotMatch(resolver, /CREATE\s+TABLE/i);
});

test('manifest completeness audit accounts for fields and compares DB dropdown governance', () => {
  assert.match(manifestAudit, /ENTERPRISE_MAPPED/);
  assert.match(manifestAudit, /WORKSPACE_ONLY/);
  assert.match(manifestAudit, /VALUE_MAPPING_REQUIRED/);
  assert.match(manifestAudit, /OBJECT_MAPPING_REQUIRED/);
  assert.match(manifestAudit, /ADMIN_REVIEW/);
  assert.match(manifestAudit, /fields_unaccounted/);
  assert.match(manifestAudit, /eip_core\.dropdown_list/);
  assert.match(manifestAudit, /eip_core\.dropdown_value/);
  assert.match(manifestAudit, /STYLE_MASTER_PRODUCT/);
  assert.match(manifestAudit, /STYLE_VARIANT_PRODUCT/);
  assert.doesNotMatch(manifestAudit, /CREATE\s+TABLE/i);
  assert.doesNotMatch(manifestAudit, /dv\.parent_id/);
});

test('frontend contract derives from existing Perfect Fit metadata and knows no DB storage', () => {
  assert.match(contract, /buildPerfectFitManifestContract/);
  assert.match(contract, /collectDeclaredFields/);
  assert.match(contract, /governanceList/);
  assert.match(contract, /eipV1Target/);
  assert.match(contract, /product_hierarchy/);
  assert.match(contract, /STYLE_VARIANT/);
  assert.match(contract, /SIZE_VARIANT/);
  assert.doesNotMatch(contract, /eip_core\./);
  assert.doesNotMatch(contract, /socket_alias_map/);
  assert.doesNotMatch(contract, /material\.attrs/);
});

test('unexecuted duplicate 0143 migration remains removed', () => {
  const migrationUrl = new URL('../db/migrations/0143_perfect_fit_manifest_surface.sql', import.meta.url);
  assert.equal(existsSync(migrationUrl), false);
});

test('ordinary PF Save cannot initiate EIP-owned or manual-review shared fields', () => {
  assert.match(projection, /policy === "EIP_WINS"/);
  assert.match(projection, /policy === "DERIVED"/);
  assert.match(projection, /policy === "MANUAL_REVIEW"/);
});
