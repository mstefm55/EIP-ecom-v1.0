import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const route = readFileSync(
  new URL('../src/routes/public_perfect_fit_workspace.js', import.meta.url),
  'utf8'
);
const projection = readFileSync(
  new URL('../src/services/perfectFit/workspaceProjection.js', import.meta.url),
  'utf8'
);
const migration = readFileSync(
  new URL('../db/migrations/0143_perfect_fit_manifest_surface.sql', import.meta.url),
  'utf8'
);
const bridge = readFileSync(
  new URL('../../../apps/samara-web/my-vite-react-app/src/lib/workspacePersistenceBridge.js', import.meta.url),
  'utf8'
);

test('workspace save is lossless first and projection happens after commit', () => {
  const commitIndex = route.indexOf('await client.query("COMMIT")');
  const projectIndex = route.indexOf('projectPerfectFitWorkspace');
  assert.ok(commitIndex > 0);
  assert.ok(projectIndex > commitIndex);
  assert.match(route, /projection_summary/);
  assert.match(route, /manifest_summary/);
  assert.match(route, /enterprise_projection/);
});

test('projection executor accepts storage targets only from resolved manifest', () => {
  assert.match(projection, /approved_mapping/);
  assert.match(projection, /RELATIONAL_COLUMN/);
  assert.match(projection, /JSONB_PATH/);
  assert.match(projection, /object_kind\) === "material"/);
  assert.match(projection, /storage\.field\) === "attrs"/);
  assert.doesNotMatch(projection, /req\.body.*table/i);
  assert.doesNotMatch(projection, /DELETE\s+FROM/i);
});

test('default Perfect Fit mapping is governed in ui_surface rather than React', () => {
  assert.match(migration, /eip_core\.ui_surface/);
  assert.match(migration, /perfect_fit_workspace_manifest/);
  assert.match(migration, /product\.style_name/);
  assert.match(migration, /material\.name/);
  assert.match(migration, /JSONB_PATH/);
  assert.doesNotMatch(bridge, /material\.name/);
  assert.doesNotMatch(bridge, /eip_core\./);
});

test('EIP-owned fields are not written from Perfect Fit projection', () => {
  assert.match(projection, /authority === "EIP"/);
  assert.match(projection, /authority === "EIP_WINS"/);
  assert.match(projection, /authority === "MANUAL_REVIEW"/);
  assert.match(migration, /'product\.enterprise_category_code'/);
  assert.match(migration, /'authority', 'EIP'/);
});
