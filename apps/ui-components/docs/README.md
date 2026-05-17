# UI Components Library

This folder stores reusable UI components that are stable enough to move into future tenant projects.

## Export surface

`apps/ui-components/src/index.js`

- `HeroViewportSlider`
- `FeaturedCoverflow`
- `ImageAssetStudioModal`
- `MemberAuthModal`
- `MemberEntryModal`

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

### ImageAssetStudioModal

Reusable image preparation modal for upload workflows.

Includes:

- real crop rectangle (drag + corner resize)
- ratio match to target size
- rotate/zoom/position/filter/export
- profile presets for product, hero, and article images

### MemberAuthModal and MemberEntryModal

Reusable member authentication UI extracted from Samara.

Files:

- `src/AuthUI/MemberAuthUI.jsx`
- `src/AuthUI/MemberAuthUI.css`
- backup copies: `src/AuthUI/MemberAuthUI.copy.jsx` and `src/AuthUI/MemberAuthUI.copy.css`

Props (core):

- `open`, `onClose`
- `form`, `onChange`, `onSubmit`, `status`
- `t` translation function (optional)
- `countryOptions` (optional)
- `termsText`, `termsItems`, `termsLoading` (optional)
- `visualImageUrl` (optional sign-in side media)

## Reuse policy

- Keep this folder free of app-specific API calls.
- Keep props data-driven (no tenant hardcoding).
- If a component is modified for one tenant, keep generic props and default behavior unchanged.

## Auth system snapshot

For auth reuse (UI + API + server references together), use:

- `apps/ui-components/auth-system/README.md`

## Next step for cross-app reuse

When a second app starts using these components, promote this folder into a workspace package (for example `packages/ui-components`) and import from that package in each app.
