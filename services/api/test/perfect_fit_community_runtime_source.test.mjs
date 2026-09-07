import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const creatorBlogPath = path.join(
  repoRoot,
  'apps/samara-web/my-vite-react-app/src/components/CreatorBlog.jsx'
);
const adapterPath = path.join(
  repoRoot,
  'apps/samara-web/my-vite-react-app/src/lib/eipApiAdapter.js'
);

const creatorBlog = fs.readFileSync(creatorBlogPath, 'utf8');
const adapter = fs.readFileSync(adapterPath, 'utf8');

test('Perfect Fit community production UI is sourced from EIP, not mock profile metrics', () => {
  assert.match(creatorBlog, /eipCommunityApi\.listBlogPosts/);
  assert.match(creatorBlog, /eipCommunityApi\.createBlogPost/);
  assert.match(creatorBlog, /eipCommunityApi\.uploadBlogAsset/);
  assert.doesNotMatch(creatorBlog, />342</);
  assert.doesNotMatch(creatorBlog, />1,894</);
  assert.doesNotMatch(creatorBlog, />9<\/b>/);
  assert.doesNotMatch(creatorBlog, />42<\/b>/);
  assert.doesNotMatch(creatorBlog, /\+18%/);
  assert.doesNotMatch(creatorBlog, /pattern_dress_1782223486101/);
  assert.doesNotMatch(creatorBlog, /pattern_trench_1782223501914/);
  assert.doesNotMatch(creatorBlog, /pattern_trouser_1782223515288/);
  assert.doesNotMatch(creatorBlog, /pattern_blouse_1782223531046/);
  assert.doesNotMatch(creatorBlog, /contentEditable=\{true\}/);
});

test('Community image selection is edited before the authenticated EIP upload', () => {
  assert.match(creatorBlog, /import ImageAssetStudioModal from '\.\/ImageAssetStudioModal'/);
  assert.match(creatorBlog, /<ImageAssetStudioModal/);
  assert.match(creatorBlog, /sourceFile=\{imageStudioSourceFile\}/);
  assert.match(creatorBlog, /onApply=\{handleCommunityImageApply\}/);
  assert.match(creatorBlog, /onChange=\{handleCommunityImageSelection\}/);
  assert.match(creatorBlog, /setImageStudioOpen\(true\)/);
  assert.match(creatorBlog, /setNewImageFile\(result\.file\)/);
  assert.match(creatorBlog, /defaultProfileId="community-post"/);
  assert.match(creatorBlog, /eipCommunityApi\.uploadBlogAsset\(newImageFile\)/);
  assert.doesNotMatch(
    creatorBlog,
    /onChange=\{\(event\) => setNewImageFile\(event\.target\.files\?\.\[0\] \|\| null\)\}/
  );
});

test('EIP member adapter exposes governed blog read/write/upload paths', () => {
  assert.match(adapter, /export const eipCommunityApi/);
  assert.match(adapter, /request\('\/blog\/posts'/);
  assert.match(adapter, /request\('\/member\/uploads'/);
  assert.match(adapter, /FormData/);
  assert.match(adapter, /X-Member-Csrf/);
});
