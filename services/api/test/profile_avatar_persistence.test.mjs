import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { serializeUserProfile } from "../src/routes/auth.js";
import { resolveAssetRoot } from "../src/services/assets/root.js";
import { verifyAssetToken } from "../src/services/assets/signing.js";
import { sanitizeAssetUrlForStorage } from "../src/services/assets/url_policy.js";

const TENANT_ID = "00000000-0000-4000-8000-0000000000aa";

test("profile avatar serialization returns a signed display URL while preserving the stored local asset path", () => {
  const app = {
    config: {
      API_KEY_PEPPER: "asset-pepper",
      ASSET_TOKEN_TTL_SEC: 60
    }
  };
  const rawPath = `/assets/${TENANT_ID}/avatars/avatar.png`;
  const profile = serializeUserProfile(app, {
    tenant_id: TENANT_ID,
    avatar_url: rawPath
  });

  assert.equal(profile.avatar_url, rawPath);
  assert.match(profile.avatar_display_url, /^\/assets\/.+\?exp=/);
  const signed = new URL(profile.avatar_display_url, "https://api.test");
  assert.equal(
    verifyAssetToken(signed.pathname, signed.searchParams.get("exp"), signed.searchParams.get("token"), "asset-pepper"),
    true
  );
});

test("profile avatar save strips signed display URL query parameters before storage", () => {
  const signed = `/assets/${TENANT_ID}/avatars/avatar.png?exp=9999999999&token=example`;
  assert.equal(
    sanitizeAssetUrlForStorage(signed, TENANT_ID),
    `/assets/${TENANT_ID}/avatars/avatar.png`
  );
});

test("asset root can be moved to a persistent Railway volume without changing public asset URLs", () => {
  const root = path.join(os.tmpdir(), "eip-assets-volume");
  assert.equal(resolveAssetRoot({ ASSET_ROOT: root }), path.resolve(root));
  assert.match(resolveAssetRoot({}), /services[\\/]api[\\/]assets$/);
});
