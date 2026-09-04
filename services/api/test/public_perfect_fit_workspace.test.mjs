import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const routeSource = readFileSync(
  new URL("../src/routes/public_perfect_fit_workspace.js", import.meta.url),
  "utf8"
);
const preflightSource = readFileSync(
  new URL("../src/routes/public_commerce_preflight.js", import.meta.url),
  "utf8"
);
const adapterSource = readFileSync(
  new URL(
    "../../../apps/samara-web/my-vite-react-app/src/lib/eipApiAdapter.js",
    import.meta.url
  ),
  "utf8"
);
const bridgeSource = readFileSync(
  new URL(
    "../../../apps/samara-web/my-vite-react-app/src/lib/workspacePersistenceBridge.js",
    import.meta.url
  ),
  "utf8"
);
const fieldContractSource = readFileSync(
  new URL(
    "../../../apps/samara-web/my-vite-react-app/src/lib/perfectFitFieldContract.js",
    import.meta.url
  ),
  "utf8"
);
const integrationMenuSource = readFileSync(
  new URL(
    "../../../apps/samara-web/my-vite-react-app/src/components/ProductIntegrationMenu.jsx",
    import.meta.url
  ),
  "utf8"
);

test("Perfect Fit workspace routes are tenant and member scoped", () => {
  assert.match(routeSource, /WORKSPACE_RECORD_TYPE\s*=\s*"PERFECT_FIT_WORKSPACE"/);
  assert.match(routeSource, /WHERE tenant_id = \$1/);
  assert.match(routeSource, /attrs->>'owner_identity_id' = \$3/);
  assert.match(routeSource, /session\.identity_id/);
  assert.match(routeSource, /attrs\.realm/);
  assert.match(routeSource, /connection_suffix/);
  assert.doesNotMatch(routeSource, /ADMIN_SUPER/);
});

test("Perfect Fit workspace writes require member CSRF", () => {
  assert.match(routeSource, /req\.cookies\?\.member_csrf/);
  assert.match(routeSource, /req\.headers\["x-member-csrf"\]/);
  assert.match(routeSource, /MEMBER_CSRF_REQUIRED/);
  assert.match(routeSource, /app\.put\(\s*"\/commerce\/:suffix\/perfect-fit\/workspace"/);
});

test("workspace persistence uses existing kernel info_record instead of a PF table", () => {
  assert.match(routeSource, /eip_core\.info_record/);
  assert.doesNotMatch(routeSource, /CREATE\s+TABLE/i);
  assert.match(routeSource, /contains_private_technical_data/);
  assert.match(routeSource, /privacy:\s*"private"/);
});

test("public preflight registers the Perfect Fit workspace routes", () => {
  assert.match(preflightSource, /registerPublicPerfectFitWorkspaceRoutes/);
  assert.match(preflightSource, /await registerPublicPerfectFitWorkspaceRoutes\(app\)/);
  assert.doesNotMatch(preflightSource, /registerPublicPerfectFitManifestRoutes/);
});

test("browser adapter persists workspace only through the public gateway", () => {
  assert.match(adapterSource, /loadWorkspace:\s*\(\)\s*=>\s*request\('\/perfect-fit\/workspace'\)/);
  assert.match(adapterSource, /saveWorkspace:[\s\S]*request\('\/perfect-fit\/workspace'/);
  assert.match(adapterSource, /field_contract/);
  assert.doesNotMatch(adapterSource, /\/api\/eip\//);
});

test("workspace bridge hydrates before render and keeps a replayable pending snapshot", () => {
  assert.match(bridgeSource, /hydrateWorkspaceFromEip/);
  assert.match(bridgeSource, /PENDING_WORKSPACE_KEY/);
  assert.match(bridgeSource, /saveWorkspaceRemotely/);
  assert.match(bridgeSource, /domain !== 'workspace'/);
  assert.match(bridgeSource, /buildPerfectFitFieldContract/);
  assert.doesNotMatch(bridgeSource, /syncLinkedEnterpriseProducts/);
});

test("field contract is serialized from existing PF metadata without DB storage knowledge", () => {
  assert.match(fieldContractSource, /workspace\.fields/);
  assert.match(fieldContractSource, /field\?\.eipV1Target/);
  assert.match(fieldContractSource, /field\?\.governanceList/);
  assert.doesNotMatch(fieldContractSource, /eip_core\./);
  assert.doesNotMatch(fieldContractSource, /material\.name/);
});

test("manual EIP integration button is removed from designer workflow", () => {
  assert.match(integrationMenuSource, /return null;/);
  assert.doesNotMatch(integrationMenuSource, />\s*EIP\s*</);
  assert.doesNotMatch(integrationMenuSource, /Sync shared metadata/);
});
