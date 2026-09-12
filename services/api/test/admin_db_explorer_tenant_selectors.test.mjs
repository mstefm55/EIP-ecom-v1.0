import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(
  new URL('../../../apps/dashboard/src/components/admin/AdminDbExplorer.jsx', import.meta.url),
  'utf8'
);

test('Admin DB explorer reuses governed tenant options for investigation and sensitive access', () => {
  assert.match(source, /loadTenants\(""\)/);
  assert.match(source, /<select[\s\S]*?value=\{breakGlassTarget\}[\s\S]*?setBreakGlassTarget\(event\.target\.value\)/);
  assert.match(source, /<select[\s\S]*?value=\{sensitiveTenant\}[\s\S]*?setSensitiveTenant\(event\.target\.value\)/);
  assert.match(source, /tenantOptions\.map\(\(tenant\) =>/);
  assert.match(source, /Select target tenant \(optional\)/);
  assert.match(source, /Select tenant/);
});
