import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

const route = read('services/api/src/routes/public_perfect_fit_community.js');
const preflight = read('services/api/src/routes/public_commerce_preflight.js');
const adapter = read('apps/samara-web/my-vite-react-app/src/lib/eipApiAdapter.js');
const repository = read('apps/samara-web/my-vite-react-app/src/lib/communityPostsRepository.js');
const adminUi = read('apps/samara-web/my-vite-react-app/src/components/admin/CommunityModerationAdmin.jsx');
const curationUi = read('apps/samara-web/my-vite-react-app/src/components/admin/PerfectFitCurationAdmin.jsx');
const governance = read('docs/PERFECT_FIT_COMMUNITY_MODERATION_GOVERNANCE.md');

test('Community Feedback defaults to immediate publication rather than a release queue', () => {
  assert.match(route, /runAutomatedCommunityReview/);
  assert.match(route, /decision:\s*"publish"/);
  assert.match(route, /if \(review\.decision === "publish"\)[\s\S]*action:\s*"PUBLISH"/);
  assert.match(route, /review\.decision === "hold" \? "pending_review" : "clear"/);
  assert.match(governance, /does \*\*not\*\* use a general pre-publication approval queue/i);
});

test('automated safety holds are not exposed by the public Community Feedback endpoint', () => {
  assert.match(route, /const PUBLIC_STATUSES = \["published", "approved", "visible"\]/);
  assert.match(route, /COMMUNITY_POST_MARKER = "pf-community-feedback"/);
  assert.match(route, /PF_COMMUNITY_MODERATION_ALERT/);
  assert.match(route, /pending_review/);
  assert.match(route, /automated-rules-v1/);
  assert.match(route, /sent to an administrator for review/i);
});

test('Community Feedback writes use the dedicated moderated EIP route', () => {
  assert.match(adapter, /createCommunityPost:[\s\S]*request\('\/community\/posts'/);
  assert.match(adapter, /listCommunityPosts:[\s\S]*request\(`\/community\/posts/);
  assert.match(repository, /eipCommunityApi\.createCommunityPost/);
  assert.match(repository, /eipCommunityApi\.listCommunityPosts/);
  assert.doesNotMatch(repository, /createPersistedPost[\s\S]{0,1200}eipCommunityApi\.createBlogPost/);
});

test('registered authors receive automated-hold and later moderation explanations', () => {
  assert.match(route, /PF_COMMUNITY_MODERATION_NOTICE/);
  assert.match(route, /createAuthorNotice/);
  assert.match(route, /Reason: \$\{criterion\}/);
  assert.match(adapter, /listCommunityModerationNotices/);
  assert.match(repository, /surfaceModerationNotices/);
  assert.match(repository, /showModerationMessage/);
});

test('PF Admin can unpublish, restore and permanently delete with grounds', () => {
  assert.match(route, /PF_ADMIN/);
  assert.match(route, /MEMBER_CSRF_REQUIRED/);
  assert.match(route, /"unpublish"/);
  assert.match(route, /action:\s*"REJECT"/);
  assert.match(route, /action:\s*"INTAKE"/);
  assert.match(route, /action:\s*"PUBLISH"/);
  assert.match(route, /COMMUNITY_MODERATION_REASON_REQUIRED/);
  assert.match(route, /DELETE FROM eip_core\.service_object/);
  assert.match(route, /PF_COMMUNITY_MODERATION_DELETE/);
  assert.match(route, /content_hash/);
});

test('Community moderation is exposed inside the existing PF Admin control surface', () => {
  assert.match(curationUi, /CommunityModerationAdmin/);
  assert.match(adminUi, /Community Feedback safety &amp; trust/);
  assert.match(adminUi, /Unpublish/);
  assert.match(adminUi, /Publish after review/);
  assert.match(adminUi, /Restore post/);
  assert.match(adminUi, /Delete permanently/);
  assert.match(adminUi, /Explanation to author/);
});

test('community routes are registered through the existing public commerce gateway plugin', () => {
  assert.match(preflight, /registerPublicPerfectFitCommunityRoutes/);
  assert.match(preflight, /await registerPublicPerfectFitCommunityRoutes\(app\)/);
});

test('AI boundary is explicit and no unconfigured AI provider is falsely claimed', () => {
  assert.match(governance, /does \*\*not\*\* claim an LLM\/AI moderation decision/i);
  assert.match(governance, /automated-rules-v1/);
  assert.match(governance, /later approved AI moderation provider/i);
});
