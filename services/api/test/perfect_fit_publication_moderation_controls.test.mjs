import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

const adminPanel = read('apps/samara-web/my-vite-react-app/src/components/AdminControlPanel.jsx');
const inlineCuration = read('apps/samara-web/my-vite-react-app/src/components/admin/PublicationModerationCuration.jsx');
const app = read('apps/samara-web/my-vite-react-app/src/App.jsx');
const route = read('services/api/src/routes/public_perfect_fit_admin.js');

test('publication queue exposes direct moderator approval without workspace navigation', () => {
  assert.match(adminPanel, /onApprovePublication/);
  assert.match(adminPanel, /Approve &amp; Publish/);
  assert.match(app, /onApprovePublication=\{handleModeratorApprove\}/);
});

test('publication queue embeds PF-admin curation controls', () => {
  assert.match(adminPanel, /PublicationModerationCuration request=\{request\}/);
  assert.match(inlineCuration, /listAdminCurationProducts/);
  assert.match(inlineCuration, /saveAdminCuration/);
  assert.match(inlineCuration, /VARIANT_CURATION/);
  assert.match(inlineCuration, /admin_selectable/);
  assert.match(inlineCuration, /do not open or modify the designer/);
  assert.doesNotMatch(inlineCuration, /loadWorkspace|saveWorkspace|runtimeDataStorage|workspacePublicationReview/);
});

test('admin curation lookup exposes only linked product identity needed to resolve the submitted variant', () => {
  assert.match(route, /PERFECT_FIT_PRODUCT_LINK/);
  assert.match(route, /ir\.payload->'perfect_fit'/);
  assert.match(route, /variant_code/);
  assert.match(route, /variant_id/);
  assert.match(route, /perfect_fit: row\.perfect_fit/);
});
