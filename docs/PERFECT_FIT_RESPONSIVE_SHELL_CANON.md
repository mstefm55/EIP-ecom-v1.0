# Perfect Fit Responsive Shell Canon

## Decision

Perfect Fit uses one responsive React application shell across desktop, tablet, and mobile browser widths.

The legacy dedicated `MobileAppView` experience is retired and must not be selected from viewport width or a persisted desktop/mobile preference. Small screens render the same current application surface as desktop, using responsive CSS/layout behavior.

## Compatibility rule

The historical browser preference key `perfectfit_view_mode` may still exist on older devices. Runtime compatibility must treat that key as `desktop`/responsive-shell mode and must never restore the legacy `mobile` application shell.

There is no customer-facing desktop/mobile shell selector. Responsive behavior is automatic through the current application layout.

The retired mobile runtime source is not part of the active application. `App.jsx` must not import, render, or select `MobileAppView`, and must not maintain a desktop/mobile shell state machine.

## Perfect Fit UI preservation rule

EIP governs business meaning, security, persistence, and metadata. Perfect Fit preserves its own richer product experience.

Backend or governance integration must not simplify Perfect Fit controls, layouts, selectors, visual hierarchy, responsive behavior, or workflows merely to match a more generic EIP administrative UI. If governed metadata needs richer capabilities for Perfect Fit, extend the governed metadata contract rather than regress the Perfect Fit interface.

Functional repairs are allowed when an existing Perfect Fit control or workflow is broken. Architectural or visual redesign is outside backend/auth/database repair scope unless explicitly approved.

## Scope

- No backend change is required to render the responsive shell.
- No database migration is required.
- No duplicate mobile application surface.
- Existing responsive mobile navigation/search/layout remain part of the current `App.jsx` shell.
- The historical `perfectfit_view_mode` compatibility key remains browser-safe and resolves only to the responsive shell.
- The retired dedicated mobile component is not an active runtime dependency.

## Regression guard

`services/api/test/perfect_fit_responsive_shell.test.mjs` is the architectural regression guard. It must verify that:

- the historical compatibility key resolves to `desktop`/responsive-shell mode;
- `App.jsx` does not import or render `MobileAppView`;
- `App.jsx` does not restore a desktop/mobile shell state machine;
- the responsive-shell canon remains explicit.
