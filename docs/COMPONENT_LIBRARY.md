# Component Library (Samara UI)

Location: `apps/samara-web/my-vite-react-app/src/component-library`

## Purpose

Central place for reusable, tenant-agnostic frontend components.

## Current components

- `HeroViewportSlider`
  - Full-viewport hero slider with overlay text, arrows, dots, autoplay, swipe.
- `FeaturedCoverflow`
  - Circular 3D card carousel with wheel + swipe interactions.

## Rules

- No tenant-specific hardcoding.
- No direct API calls inside components.
- Inputs via props only.
- Keep default styles and behavior generic.

## Export entry

`apps/samara-web/my-vite-react-app/src/component-library/index.js`

## Promotion path

If reused by multiple apps, extract into a workspace package (example: `packages/ui-components`) and import from there.
