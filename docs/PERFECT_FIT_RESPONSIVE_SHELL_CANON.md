# Perfect Fit Responsive Shell Canon

## Decision

Perfect Fit uses one responsive React application shell across desktop, tablet, and mobile browser widths.

The legacy dedicated `MobileAppView` experience is retired and must not be selected from viewport width or a persisted desktop/mobile preference. Small screens render the same current application surface as desktop, using responsive CSS/layout behavior.

## Compatibility rule

The historical browser preference key `perfectfit_view_mode` may still exist on older devices. Runtime compatibility must treat that key as `desktop`/responsive-shell mode and must never restore the legacy `mobile` application shell.

There is no customer-facing desktop/mobile shell selector. Responsive behavior is automatic through the current application layout.

## Scope

- No backend change.
- No database migration.
- No duplicate mobile application surface.
- Existing responsive mobile navigation/search/layout remain part of the current `App.jsx` shell.
- `MobileAppView.jsx` may remain temporarily as unreachable legacy code until a later cleanup, but runtime navigation must not render it.
