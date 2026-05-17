# Samara Component Library

This folder stores reusable UI components that are stable enough to move into future tenant projects.

## Export surface

`src/component-library/index.js`

- `HeroViewportSlider`
- `FeaturedCoverflow`

## Components

### HeroViewportSlider

Use for full-width hero sections with text overlay.

Props:

- `slides`: array of `{ id, image, eyebrow, title, subtitle, ctaLabel, ctaUrl, overlay }`
- `autoPlay` (default `true`)
- `intervalMs` (default `6800`)
- `pauseAfterManualMs` (default `11000`)
- `minHeight` (default `clamp(430px, 72vh, 760px)`)
- `ariaLabel`
- `onCta(slide)` optional callback for CTA button behavior

Behavior:

- Auto-rotates slides.
- Manual navigation pauses timer for a grace window.
- Includes arrows, dots, and swipe support.

### FeaturedCoverflow

3D card carousel used in featured sections.

Props:

- `items`
- `compact`
- `ariaLabel`
- `autoPlay`
- `intervalMs`
- `showActiveDetails`
- `theme`

Behavior:

- Circular flow.
- Wheel and pointer gesture navigation.
- Auto-play with manual pause window.

## Reuse policy

- Keep this folder free of app-specific API calls.
- Keep props data-driven (no tenant hardcoding).
- If a component is modified for one tenant, keep generic props and default behavior unchanged.

## Next step for cross-app reuse

When a second app starts using these components, promote this folder into a workspace package (for example `packages/ui-components`) and import from that package in each app.
