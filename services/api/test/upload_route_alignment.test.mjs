import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

const routeFiles = [
  ["services/api/src/routes/ecom.js", "/uploads"],
  ["services/api/src/routes/auth.js", "/auth/profile/avatar"],
  ["services/api/src/routes/admin_access.js", "/admin/tenants/:tenantId/users/:identityId/avatar"],
  ["services/api/src/routes/public_commerce.js", "/commerce/:suffix/member/uploads"]
];

const reusableSnapshotFiles = [
  "apps/ui-components/auth-system/server/routes/auth.copy.js",
  "apps/ui-components/auth-system/server/routes/public_commerce.copy.js"
];

test("all live media upload routes use the shared hardened storage boundary", () => {
  for (const [relativePath, endpoint] of routeFiles) {
    const source = read(relativePath);
    assert.match(source, new RegExp(endpoint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(source, /createUploadErrorHandler/);
    assert.match(source, /ensureUploadDirectory/);
    assert.match(source, /safeUploadTarget/);
    assert.match(source, /uploadPartToBuffer/);
    assert.match(source, /UPLOAD_MAX_BYTES/);
    assert.match(source, /sendUploadFailure/);
    assert.match(source, /INVALID_IMAGE/);
    assert.doesNotMatch(source, /UPLOAD_FAILED/);
    assert.doesNotMatch(source, /fs\.mkdirSync/);
    assert.doesNotMatch(source, /fs\.writeFileSync/);
  }
});

test("public member uploads allow the configured multipart size and preserve idempotent failures", () => {
  const source = read("services/api/src/routes/public_commerce.js");
  assert.match(source, /bodyLimit:\s*Number\(app\.config\.UPLOAD_MAX_BYTES/);
  assert.match(source, /normalizeUploadError\(error\)/);
  assert.match(source, /finalizeIdempotency\(app\.db/);
  assert.match(source, /response:\s*\{ ok: false, error: failure\.code, message: failure\.message \}/);
});

test("dashboard and Samara upload clients surface safe structured API messages", () => {
  const apiClient = read("apps/dashboard/src/services/apiClient.js");
  const productStudio = read("apps/dashboard/src/components/ecom/EcomProductWorkspace.jsx");
  const adminShell = read("apps/dashboard/src/components/admin/AdminShell.jsx");
  const adminUsers = read("apps/dashboard/src/components/admin/AdminUsersPanel.jsx");
  const samara = read("apps/samara-web/my-vite-react-app/src/services/api.js");
  const samaraSnapshot = read("apps/ui-components/auth-system/frontend/samara-services.api.copy.js");

  assert.match(apiClient, /error\.userMessage = typeof payload\?\.message/);
  assert.match(productStudio, /STORAGE_NOT_WRITABLE/);
  assert.match(productStudio, /parsed\.payload\?\.message/);
  assert.match(adminShell, /err\.userMessage \|\| err\.message/);
  assert.match(adminUsers, /err\.userMessage \|\| err\.message/);
  for (const source of [samara, samaraSnapshot]) {
    assert.match(source, /payload\?\.message \|\| payload\?\.error/);
  }
});

test("dashboard product uploads reject incomplete payloads and throttle media batches", () => {
  const productStudio = read("apps/dashboard/src/components/ecom/EcomProductWorkspace.jsx");
  const uploadSecurity = read("services/api/src/lib/uploadSecurity.js");

  assert.match(productStudio, /payload\?\.ok !== true/);
  assert.match(productStudio, /UPLOAD_SCAN_PENDING/);
  assert.match(productStudio, /UPLOAD_MISSING_URL/);
  assert.match(productStudio, /UPLOAD_BATCH_CONCURRENCY\s*=\s*2/);
  assert.match(productStudio, /function uploadFilesWithLimit/);
  assert.match(productStudio, /uploadFilesWithLimit\(preparedFiles,\s*\{ assetKind: "media" \}\)/);
  assert.match(productStudio, /uploadFilesWithLimit\(files,\s*\{ assetKind: "document" \}\)/);
  assert.doesNotMatch(
    productStudio,
    /Promise\.all\(\s*preparedFiles\.map\(\(file\) => fileToAsset\(file,\s*\{ assetKind: "media" \}\)\)\s*\)/s
  );
  assert.doesNotMatch(
    productStudio,
    /Promise\.all\(\s*files\.map\(\(file\) => fileToAsset\(file,\s*\{ assetKind: "document" \}\)\)\s*\)/s
  );

  assert.match(uploadSecurity, /await fs\.promises\.writeFile\(targetPath/);
  assert.match(uploadSecurity, /await fs\.promises\.rename\(quarantinePath,\s*targetPath\)/);
});

test("reusable auth-system upload snapshots carry the same hardened boundary", () => {
  const readme = read("apps/ui-components/auth-system/README.md");
  assert.match(readme, /copy repository.*not the live runtime source/is);
  assert.match(readme, /services\/api\/src\/routes\/auth\.js/);
  assert.match(readme, /services\/api\/src\/routes\/public_commerce\.js/);
  for (const relativePath of reusableSnapshotFiles) {
    const source = read(relativePath);
    assert.match(source, /createUploadErrorHandler/);
    assert.match(source, /ensureUploadDirectory/);
    assert.match(source, /safeUploadTarget/);
    assert.match(source, /validateImageUpload/);
    assert.match(source, /writeVerifiedUpload/);
    assert.doesNotMatch(source, /UPLOAD_FAILED/);
    assert.doesNotMatch(source, /fs\.writeFileSync/);
  }
});

test("API container initializes Railway volume ownership before dropping privileges", () => {
  const dockerfile = read("services/api/Dockerfile");
  const entrypoint = read("services/api/docker-entrypoint.sh");

  assert.match(dockerfile, /gosu/);
  assert.match(dockerfile, /ENTRYPOINT \["dumb-init", "--", "\/app\/docker-entrypoint\.sh"\]/);
  assert.match(entrypoint, /upload_root="\/data\/eip-assets"/);
  assert.match(entrypoint, /chown -R node:node/);
  assert.match(entrypoint, /exec gosu node "\$@"/);
  assert.match(entrypoint, /"\/"\|"\/app"\|"\/data"/);
});
