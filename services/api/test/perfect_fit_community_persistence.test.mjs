import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const repository = fs.readFileSync(
  path.join(repoRoot, 'apps/samara-web/my-vite-react-app/src/lib/communityPostsRepository.js'),
  'utf8'
);
const bootstrap = fs.readFileSync(
  path.join(repoRoot, 'apps/samara-web/my-vite-react-app/src/lib/runtimeRepositoryBootstrap.js'),
  'utf8'
);
const adapter = fs.readFileSync(
  path.join(repoRoot, 'apps/samara-web/my-vite-react-app/src/lib/eipApiAdapter.js'),
  'utf8'
);
const communityRoute = fs.readFileSync(
  path.join(repoRoot, 'services/api/src/routes/public_perfect_fit_community.js'),
  'utf8'
);
const bindingRepair = fs.readFileSync(
  path.join(repoRoot, 'services/api/db/migrations/0149_perfect_fit_community_blog_process_binding.sql'),
  'utf8'
);

test('production COMMUNITY_POSTS uses the EIP repository instead of browser-only storage', () => {
  assert.match(bootstrap, /createCommunityPostsRepository/);
  assert.match(bootstrap, /domain === 'communityPosts'/);
  assert.match(bootstrap, /!enableDemoData && isEipApiConfigured\(\)/);
  assert.match(bootstrap, /storageKey: contract\.storageKey/);
});

test('community repository persists and reloads through the governed community API', () => {
  assert.match(repository, /eipCommunityApi\.listCommunityPosts/);
  assert.match(repository, /eipCommunityApi\.createCommunityPost/);
  assert.match(repository, /eipCommunityApi\.uploadBlogAsset/);
  assert.match(repository, /await writeQueue/);
  assert.match(repository, /MIGRATABLE_ID_PREFIX = 'community-post-'/);
  assert.match(repository, /pf-community-feedback/);
});

test('community create remains process-governed and returns only committed EIP records', () => {
  assert.match(communityRoute, /createBlogProcess/);
  assert.match(communityRoute, /PROCESS_BINDING_REQUIRED/);
  assert.match(communityRoute, /action: "INTAKE"/);
  assert.match(communityRoute, /action: "PUBLISH"/);
  assert.match(communityRoute, /await client\.query\("COMMIT"\)/);
});

test('0149 repairs the blog process binding for connected storefront tenants', () => {
  assert.match(bindingRepair, /0149_perfect_fit_community_blog_process_binding/);
  assert.match(bindingRepair, /connection_profiles/);
  assert.match(bindingRepair, /ECOM_BLOG_POST_FLOW/);
  assert.match(bindingRepair, /service_object_type[\s\S]*'blog_post'/);
  assert.match(bindingRepair, /is_active = true/);
  assert.doesNotMatch(bindingRepair, /service_object_type\s*=\s*'product'/);
});

test('creator blog remains separated from Community Feedback records', () => {
  assert.match(adapter, /EIP_COMMUNITY_POST_MARKER = 'pf-community-feedback'/);
  assert.match(adapter, /communityOnly = false/);
  assert.match(adapter, /includeCommunity = false/);
  assert.match(adapter, /items\.filter\(itemIsCommunityFeedback\)/);
  assert.match(adapter, /items\.filter\(\(item\) => !itemIsCommunityFeedback\(item\)\)/);
});
