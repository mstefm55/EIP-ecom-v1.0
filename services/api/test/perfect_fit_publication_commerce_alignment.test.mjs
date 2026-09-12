import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const publicationRoute = fs.readFileSync(
  path.join(repoRoot, 'services/api/src/routes/public_perfect_fit_publication.js'),
  'utf8'
);
const commerceRoute = fs.readFileSync(
  path.join(repoRoot, 'services/api/src/routes/public_commerce.js'),
  'utf8'
);
const runtimeMetadata = fs.readFileSync(
  path.join(repoRoot, 'apps/samara-web/my-vite-react-app/src/lib/perfectFitRuntimeMetadata.js'),
  'utf8'
);

test('PF moderation projects process status to the canonical commerce workflow stage', () => {
  assert.match(publicationRoute, /PUBLISHED:\s*["']published["']/);
  assert.match(publicationRoute, /REVIEW:\s*["']review["']/);
  assert.match(publicationRoute, /REJECTED:\s*["']rejected["']/);
  assert.match(publicationRoute, /stage:\s*canonicalStage/);
});

test('reused PUBLISHED moderation action repairs legacy material projection before commit', () => {
  const reusedPublished = publicationRoute.match(
    /if \(node === ["']content_published["']\) \{([\s\S]*?)return reply\.send\(response\);/
  );
  assert.ok(reusedPublished, 'published reuse branch must exist');
  assert.match(reusedPublished[1], /updateMaterialPublicationProjection/);
  assert.match(reusedPublished[1], /status:\s*["']PUBLISHED["']/);
  assert.match(reusedPublished[1], /client\.query\(["']COMMIT["']\)/);
});

test('public commerce continues to gate sale eligibility on canonical published stage', () => {
  assert.match(
    commerceRoute,
    /attrs->'workflow'->>'stage'[\s\S]*PUBLISHED_STAGE|PUBLISHED_STAGE[\s\S]*attrs->'workflow'->>'stage'/
  );
});

test('runtime metadata hydration does not splice frozen governed arrays', () => {
  assert.match(runtimeMetadata, /Object\.isFrozen\(target\)/);
  assert.match(runtimeMetadata, /!Object\.isExtensible\(target\)/);
  assert.match(runtimeMetadata, /if \(!replaceArrayContents\(container\[key\], next\)\) \{\s*container\[key\] = next;/);
});
