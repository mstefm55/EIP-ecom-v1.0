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

test('production COMMUNITY_POSTS uses the EIP repository instead of browser-only storage', () => {
  assert.match(bootstrap, /createCommunityPostsRepository/);
  assert.match(bootstrap, /domain === 'communityPosts'/);
  assert.match(bootstrap, /!enableDemoData && isEipApiConfigured\(\)/);
  assert.match(bootstrap, /storageKey: contract\.storageKey/);
});

test('community repository persists and reloads through the governed blog API', () => {
  assert.match(repository, /eipCommunityApi\.listBlogPosts\(\{[\s\S]*communityOnly: true/);
  assert.match(repository, /eipCommunityApi\.createBlogPost/);
  assert.match(repository, /eipCommunityApi\.uploadBlogAsset/);
  assert.match(repository, /eipCommunityApi\.deleteBlogPost/);
  assert.match(repository, /await writeQueue/);
  assert.match(repository, /MIGRATABLE_ID_PREFIX = 'community-post-'/);
  assert.match(repository, /pf-community-feedback/);
});

test('creator blog excludes Community Feedback records while the community repository can request them', () => {
  assert.match(adapter, /EIP_COMMUNITY_POST_MARKER = 'pf-community-feedback'/);
  assert.match(adapter, /communityOnly = false/);
  assert.match(adapter, /includeCommunity = false/);
  assert.match(adapter, /items\.filter\(itemIsCommunityFeedback\)/);
  assert.match(adapter, /items\.filter\(\(item\) => !itemIsCommunityFeedback\(item\)\)/);
});
