import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const service = readFileSync(
  new URL('../src/services/perfectFit/manifestCoordinator.js', import.meta.url),
  'utf8'
);
const route = readFileSync(
  new URL('../src/routes/public_perfect_fit_manifest.js', import.meta.url),
  'utf8'
);
const preflight = readFileSync(
  new URL('../src/routes/public_commerce_preflight.js', import.meta.url),
  'utf8'
);

const frontendManifest = readFileSync(
  new URL('../../../apps/samara-web/my-vite-react-app/src/lib/perfectFitManifest.js', import.meta.url),
  'utf8'
);

test('manifest coordinator uses existing EIP governance structures', () => {
  assert.match(service, /eip_core\.ui_surface/);
  assert.match(service, /attrs\.mapping|attrs\?\.mapping/);
  assert.match(service, /eip_core\.schema_registry/);
  assert.match(service, /eip_core\.dropdown_list/);
  assert.match(service, /eip_core\.dropdown_value/);
  assert.match(service, /information_schema\.columns/);
  assert.doesNotMatch(service, /CREATE\s+TABLE/i);
});

test('manifest routes remain connection, tenant and member scoped', () => {
  assert.match(route, /connectionAllowsOrigin/);
  assert.match(route, /verifyConnectionRequest/);
  assert.match(route, /member_sid/);
  assert.match(route, /MEMBER_UNAUTHENTICATED/);
  assert.match(route, /MEMBER_CSRF_REQUIRED/);
  assert.match(route, /access\.tenant\.id/);
  assert.match(route, /perfect-fit\/manifest\/reconcile/);
  assert.match(preflight, /registerPublicPerfectFitManifestRoutes/);
});

test('browser manifest describes logical PF fields without database storage targets', () => {
  assert.match(frontendManifest, /buildPerfectFitFieldManifest/);
  assert.match(frontendManifest, /governance_list/);
  assert.match(frontendManifest, /object_kind/);
  assert.doesNotMatch(frontendManifest, /eip_core\./);
  assert.doesNotMatch(frontendManifest, /material\.name/);
  assert.doesNotMatch(frontendManifest, /info_record/);
});

test('coordinator only introspects an allow-listed kernel object set', () => {
  for (const table of ['material', 'asset', 'service_object', 'info_record', 'object_link']) {
    assert.match(service, new RegExp(`"${table}"`));
  }
  assert.match(service, /table_name = ANY\(\$1::text\[\]\)/);
});
