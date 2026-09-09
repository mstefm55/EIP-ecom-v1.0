import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const preferences = fs.readFileSync(
  path.join(repoRoot, 'apps/samara-web/my-vite-react-app/src/lib/clientPreferences.js'),
  'utf8'
);
const app = fs.readFileSync(
  path.join(repoRoot, 'apps/samara-web/my-vite-react-app/src/App.jsx'),
  'utf8'
);
const canon = fs.readFileSync(
  path.join(repoRoot, 'docs/PERFECT_FIT_RESPONSIVE_SHELL_CANON.md'),
  'utf8'
);

test('legacy mobile shell preference is retired in favour of the responsive app shell', () => {
  assert.match(preferences, /LEGACY_VIEW_MODE_KEY\s*=\s*'perfectfit_view_mode'/);
  assert.match(preferences, /if \(key === LEGACY_VIEW_MODE_KEY\) return 'desktop'/);
  assert.match(preferences, /storage\(\)\?\.setItem\(key, 'desktop'\)/);

  assert.doesNotMatch(app, /MobileAppView/);
  assert.doesNotMatch(app, /\[viewMode,\s*setViewMode\]/);
  assert.doesNotMatch(app, /setViewMode\('mobile'\)/);
  assert.doesNotMatch(app, /if \(viewMode === 'mobile'\)/);

  assert.match(canon, /one responsive React application shell/i);
  assert.match(canon, /must never restore the legacy `mobile` application shell/i);
  assert.match(canon, /retired mobile runtime source is not part of the active application/i);
});