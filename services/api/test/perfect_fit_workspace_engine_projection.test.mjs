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
const contract = readFileSync(
  new URL('../../../apps/samara-web/my-vite-react-app/src/lib/perfectFitFieldContract.js', import.meta.url),
  'utf8'
);

test('lossless workspace commit happens before enterprise projection', () => {
  const commitIndex = route.indexOf('await client.query("COMMIT")');
  const projectionIndex = route.indexOf('projectPerfectFitWorkspaceProducts');
  assert.ok(commitIndex > 0);
  assert.ok(projectionIndex > commitIndex);
  assert.match(route, /Projection failure is reported but never rolls back/);
});

test('PF projection reuses socket resolver and existing product gateway', () => {
  assert.match(projection, /resolveSocketFieldAliases/);
  assert.match(projection, /registerPerfectFitProduct/);
  assert.match(projection, /syncPerfectFitProduct/);
  assert.doesNotMatch(projection, /INSERT\s+INTO\s+eip_core\.material/i);
  assert.doesNotMatch(projection, /UPDATE\s+eip_core\.material/i);
  assert.doesNotMatch(projection, /eip_core\.ui_surface/);
});

test('generic resolver uses existing SmartSocket and dropdown governance tables', () => {
  assert.match(resolver, /eip_commerce\.socket_alias_map/);
  assert.match(resolver, /eip_commerce\.socket_manifest/);
  assert.match(resolver, /eip_core\.dropdown_list/);
  assert.match(resolver, /eip_core\.dropdown_value/);
  assert.doesNotMatch(resolver, /CREATE\s+TABLE/i);
});

test('frontend contract derives from existing Perfect Fit metadata and knows no DB storage', () => {
  assert.match(contract, /workspace\.fields/);
  assert.match(contract, /eipV1Target/);
  assert.match(contract, /governanceList/);
  assert.doesNotMatch(contract, /eip_core\./);
  assert.doesNotMatch(contract, /socket_alias_map/);
  assert.doesNotMatch(contract, /material\.attrs/);
});

test('unexecuted duplicate 0143 migration is removed from rework branch', () => {
  const migrationUrl = new URL('../db/migrations/0143_perfect_fit_manifest_surface.sql', import.meta.url);
  assert.equal(existsSync(migrationUrl), false);
});

test('ordinary PF Save cannot initiate EIP-owned or manual-review shared fields', () => {
  assert.match(projection, /policy === "EIP_WINS"/);
  assert.match(projection, /policy === "DERIVED"/);
  assert.match(projection, /policy === "MANUAL_REVIEW"/);
});
