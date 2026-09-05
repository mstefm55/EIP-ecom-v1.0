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
const metadataServiceSource = readFileSync(
  new URL("../src/services/perfectFit/metadataManifest.js", import.meta.url),
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
const runtimeMetadataSource = readFileSync(
  new URL(
    "../../../apps/samara-web/my-vite-react-app/src/lib/perfectFitRuntimeMetadata.js",
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

test("public preflight registers the Perfect Fit workspace and metadata routes", () => {
  assert.match(preflightSource, /registerPublicPerfectFitWorkspaceRoutes/);
  assert.match(preflightSource, /await registerPublicPerfectFitWorkspaceRoutes\(app\)/);
  assert.match(routeSource, /\/commerce\/:suffix\/perfect-fit\/metadata/);
});

test("browser reads DB metadata and sends business workspace only", () => {
  assert.match(adapterSource, /loadMetadata:\s*\(\)\s*=>\s*request\('\/perfect-fit\/metadata'\)/);
  assert.match(adapterSource, /loadWorkspace:\s*\(\)\s*=>\s*request\('\/perfect-fit\/workspace'\)/);
  assert.match(adapterSource, /saveWorkspace:\s*\(workspace\)/);
  assert.match(adapterSource, /body:\s*\{\s*workspace\s*\}/);
  assert.doesNotMatch(adapterSource, /manifest_contract/);
  assert.doesNotMatch(adapterSource, /field_contract/);
  assert.doesNotMatch(adapterSource, /\/api\/eip\//);
});

test("workspace bridge never rebuilds or uploads a frontend metadata manifest", () => {
  assert.match(bridgeSource, /hydrateWorkspaceFromEip/);
  assert.match(bridgeSource, /PENDING_WORKSPACE_KEY/);
  assert.match(bridgeSource, /saveWorkspaceRemotely/);
  assert.match(bridgeSource, /domain !== 'workspace'/);
  assert.doesNotMatch(bridgeSource, /buildPerfectFitManifestContract/);
  assert.doesNotMatch(bridgeSource, /manifest_contract/);
  assert.doesNotMatch(bridgeSource, /field_contract/);
});

test("runtime workspace metadata is hydrated from EIP DB before use", () => {
  assert.match(runtimeMetadataSource, /eipApiAdapter\.loadMetadata\(\)/);
  assert.match(runtimeMetadataSource, /source:\s*'EIP_DB'/);
  assert.match(runtimeMetadataSource, /replaceObjectContents\(target\.fields/);
  assert.match(runtimeMetadataSource, /replaceObjectContents\(target\.dropdowns/);
  assert.match(runtimeMetadataSource, /replaceObjectContents\(target\.structure/);
  assert.match(runtimeMetadataSource, /replaceObjectContents\(target\.referenceConvention/);
});

test("server metadata loader uses existing EIP governance tables", () => {
  assert.match(metadataServiceSource, /eip_commerce\.socket_manifest/);
  assert.match(metadataServiceSource, /eip_core\.dropdown_list/);
  assert.match(metadataServiceSource, /eip_core\.dropdown_value/);
  assert.match(metadataServiceSource, /authority:\s*"EIP_DB"/);
  assert.doesNotMatch(metadataServiceSource, /perfectFitMetadata/);
  assert.doesNotMatch(metadataServiceSource, /CREATE\s+TABLE/i);
});

test("manual EIP integration button is removed from designer workflow", () => {
  assert.match(integrationMenuSource, /return null;/);
  assert.doesNotMatch(integrationMenuSource, />\s*EIP\s*</);
  assert.doesNotMatch(integrationMenuSource, /Sync shared metadata/);
});
