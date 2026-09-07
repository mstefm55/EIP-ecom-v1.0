import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const css = fs.readFileSync(
  path.join(repoRoot, 'apps/samara-web/my-vite-react-app/src/index.css'),
  'utf8'
);
const feedback = fs.readFileSync(
  path.join(repoRoot, 'apps/samara-web/my-vite-react-app/src/components/CreationsAndFeedback.jsx'),
  'utf8'
);
const homeShowcase = fs.readFileSync(
  path.join(repoRoot, 'apps/samara-web/my-vite-react-app/src/components/TestimonialCarousel.jsx'),
  'utf8'
);

test('Community Feedback suppresses the legacy duplicate spotlight presentation', () => {
  assert.match(
    css,
    /#atelier-showroom-feedback-section\s+#spotlight-carousel-container\s*\{\s*display:\s*none;\s*\}/s
  );
  assert.match(feedback, /id="showroom-posts-grid"/);
  assert.match(feedback, /max-h-\[160px\]/);
});

test('home-page feedback and Community Feedback share the canonical community collection', () => {
  assert.match(homeShowcase, /RUNTIME_DOMAINS\.COMMUNITY_POSTS/);
  assert.match(feedback, /RUNTIME_DOMAINS\.COMMUNITY_POSTS/);
  assert.doesNotMatch(homeShowcase, /type="url"/);
});

test('large showcase remains owned by the home page rather than duplicated in Community Feedback', () => {
  assert.match(homeShowcase, /id="testimonials-carousel-container"/);
  assert.match(homeShowcase, /id="testimonial-carousel-slide"/);
});
