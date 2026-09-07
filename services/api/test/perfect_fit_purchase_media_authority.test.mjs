import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');

const read = (relativePath) =>
  fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');

const presentationSource = read(
  'apps/samara-web/my-vite-react-app/src/lib/workspaceProductPresentation.js'
);
const runtimeBootstrapSource = read(
  'apps/samara-web/my-vite-react-app/src/lib/runtimeRepositoryBootstrap.js'
);

test('Workspace remains the sole customer-media authority for Workspace products', () => {
  assert.match(presentationSource, /mediaAuthority:\s*'WORKSPACE'/);
  assert.match(presentationSource, /image:\s*presentation\.image\s*\|\|\s*''/);
  assert.match(presentationSource, /primaryImage:\s*presentation\.primaryImage\s*\|\|\s*''/);
  assert.match(presentationSource, /technicalSketchAsset:\s*presentation\.technicalSketchAsset\s*\|\|\s*null/);
  assert.match(presentationSource, /technicalSketchUrl:\s*presentation\.technicalSketchUrl\s*\|\|\s*''/);

  assert.doesNotMatch(
    presentationSource,
    /image:\s*presentation\.image\s*\|\|\s*commerce\?\.image/
  );
  assert.doesNotMatch(
    presentationSource,
    /technicalSketchAsset:\s*presentation\.technicalSketchAsset\s*\|\|\s*commerce/
  );
});

test('Production runtime scrubs stale cart photos when a Workspace product has no customer media', () => {
  assert.match(runtimeBootstrapSource, /sanitizeWorkspaceCartMedia/);
  assert.match(runtimeBootstrapSource, /WORKSPACE_CART_IMAGE_FIELDS/);
  assert.match(runtimeBootstrapSource, /mediaProvenance\s*=\s*'WORKSPACE_NONE'/);
  assert.match(runtimeBootstrapSource, /remove_non_workspace_media_fallback/);
});
