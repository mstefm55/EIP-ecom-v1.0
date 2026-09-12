import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const adapter = readFileSync(
  new URL('../../../apps/samara-web/my-vite-react-app/src/lib/eipApiAdapter.js', import.meta.url),
  'utf8'
);
const bridge = readFileSync(
  new URL('../../../apps/samara-web/my-vite-react-app/src/lib/workspacePersistenceBridge.js', import.meta.url),
  'utf8'
);
const publicationRoute = readFileSync(
  new URL('../src/routes/public_perfect_fit_publication.js', import.meta.url),
  'utf8'
);

test('Perfect Fit adapter exposes the governed EIP publication process endpoints', () => {
  assert.match(adapter, /submitPublicationRequest/);
  assert.match(adapter, /\/perfect-fit\/publication-requests['"]/);
  assert.match(adapter, /listMyPublicationRequests/);
  assert.match(adapter, /\/perfect-fit\/publication-requests\/mine/);
  assert.match(adapter, /listAdminPublicationRequests/);
  assert.match(adapter, /\/perfect-fit\/admin\/publication-requests/);
  assert.match(adapter, /moderatePublicationRequest/);
  assert.match(adapter, /\/perfect-fit\/admin\/publication-requests\/\$\{encodeURIComponent/);
  assert.match(adapter, /idempotent:\s*true/);
});

test('workspace persistence bridges legacy publication presentation state into EIP authority', () => {
  assert.match(bridge, /collectWorkspacePublicationIntents/);
  assert.match(bridge, /listMyPublicationRequests/);
  assert.match(bridge, /submitPublicationRequest/);
  assert.match(bridge, /moderatePublicationRequest/);
  assert.match(bridge, /'PUBLISH'/);
  assert.match(bridge, /'RETURN'/);
  assert.match(bridge, /perfectfit_workspace_commerce_profile_reconciled_v2/);
});

test('publication bridge sends only a bounded customer-facing identity projection', () => {
  const intentSection = bridge.match(
    /function collectWorkspacePublicationIntents\([\s\S]*?return intents;\n}/
  );
  assert.ok(intentSection, 'publication intent collector must exist');
  assert.match(intentSection[0], /const pattern = \{/);
  assert.match(intentSection[0], /styleName/);
  assert.match(intentSection[0], /variantCode/);
  assert.match(intentSection[0], /eipProductId/);
  assert.doesNotMatch(intentSection[0], /pattern:\s*workspace/);
  assert.doesNotMatch(intentSection[0], /customer_projection:\s*workspace/);
});

test('publication authority failure cannot discard a successful private workspace save', () => {
  assert.match(bridge, /saved_with_publication_warning/);
  assert.match(bridge, /publicationAuthority = await reconcileWorkspacePublicationAuthority/);
  assert.match(bridge, /clearPendingWorkspace\(\)/);
  assert.doesNotMatch(
    bridge,
    /publicationAuthority = await reconcileWorkspacePublicationAuthority[\s\S]{0,600}throw error/
  );
});

test('server publication authority remains role and process guarded', () => {
  assert.match(publicationRoute, /requireAdminSession/);
  assert.match(publicationRoute, /PF_ADMIN_REQUIRED/);
  assert.match(publicationRoute, /ECOM_STOREFRONT_CONTENT_FLOW/);
  assert.match(publicationRoute, /PUBLICATION_ACTION_INVALID/);
  assert.match(publicationRoute, /\["PUBLISH", "RETURN"\]/);
  assert.match(publicationRoute, /updateMaterialPublicationProjection/);
});
