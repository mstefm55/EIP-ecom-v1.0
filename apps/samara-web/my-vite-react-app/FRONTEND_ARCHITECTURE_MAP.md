# Perfect Fit Bureau — Current Frontend Architecture Map

Updated: 2026-09-09  
Active application: `apps/samara-web/my-vite-react-app`

This document describes the current production architecture. Historical discovery notes that treated Perfect Fit as a browser-authoritative mock application are obsolete.

## 1. Architectural boundary

Perfect Fit is a React/Vite application surface. It does not own a separate trusted backend and does not connect directly to PostgreSQL.

Canonical topology:

```text
Perfect Fit browser UI
  -> EIP Gateway / public-commerce / MEMBER endpoints
  -> EIP services, kernel, process engine and governed metadata
  -> PostgreSQL
```

EIP is authoritative for security, tenant resolution, governed business meaning and server persistence. Perfect Fit remains authoritative for its product-specific presentation and interaction design.

### UI preservation rule

EIP governance must not downgrade the Perfect Fit user experience. Governed metadata may drive values, availability, ordering and behavior while Perfect Fit renders those contracts through its own richer selectors, cards, layouts, Image Studio, responsive navigation and workflow surfaces.

Do not replace a richer Perfect Fit control with a generic EIP administrative control merely because EIP owns the metadata.

## 2. Responsive application shell

Perfect Fit uses one responsive React application shell for desktop, tablet and mobile browser widths.

- The dedicated historical `MobileAppView` application shell is retired.
- Viewport width must not select a second application implementation.
- The historical `perfectfit_view_mode` preference key is compatibility-only and resolves to the responsive shell.
- Mobile navigation, mobile search and responsive layout are features of the same active `App.jsx` application.
- There is no customer-facing desktop/mobile shell selector.

Canonical decision: `docs/PERFECT_FIT_RESPONSIVE_SHELL_CANON.md`.

## 3. Runtime entry and presentation

`src/main.jsx` is the Vite browser entry point. It mounts the React application and imports the existing global stylesheet from `src/index.css`.

`src/App.jsx` remains the top-level presentation/orchestration surface for navigation, catalogue presentation, drawers/modals and responsive navigation. It must not become a persistence or authentication authority.

Important presentation modules include:

- `components/CatalogSidebarNavigator.jsx`
- `components/PatternQuickViewModal.jsx`
- `components/CheckoutDrawer.jsx`
- `components/WishlistDrawer.jsx`
- `components/MemberManagement.jsx`
- `components/CreationsAndFeedback.jsx`
- `components/AdminControlPanel.jsx`
- `components/Workspace.jsx`
- `components/workspace/WorkspaceMedia.jsx`
- `components/SewingSessionTimer.jsx`
- `components/MannequinGuide.jsx`

The visual identity remains in `src/index.css`, Tailwind utility classes and Perfect Fit metadata/configuration. Backend repairs must not rewrite those presentation decisions.

## 4. Runtime repository boundary

Generic frontend state is exposed through the runtime repository layer rather than treating React component state or browser storage as enterprise authority.

Key files:

- `src/context/RuntimeDataContext.jsx`
- `src/lib/runtimeRepositoryBootstrap.js`
- `src/lib/runtimeDomainContracts.js`
- `src/lib/eipApiAdapter.js`

`useRuntimeState()` / `useRuntimeCollectionState()` are repository interfaces. The actual authority depends on the domain and must be inspected before changing persistence behavior.

Browser storage may still be used for presentation preferences, transient resilience, caches and compatibility. Its presence does not make it the authoritative enterprise store.

## 5. Private Workspace persistence

Private designer Workspace persistence is EIP-backed.

Canonical flow:

```text
Workspace UI
  -> workspacePersistenceBridge.js
  -> MEMBER-authenticated EIP Perfect Fit Workspace route
  -> EIP info_record (PERFECT_FIT_WORKSPACE)
```

Key files:

- `src/lib/workspacePersistenceBridge.js`
- `services/api/src/routes/public_perfect_fit_workspace.js`

The browser-side workspace repository is a cache/outbox and resilience layer. EIP is the server authority for the private Workspace snapshot.

The server may project governed enterprise data from the private snapshot into existing kernel objects such as materials, variants, assets and publication records. Projection failure must not destroy the designer's private save.

PF Admin/moderator access must not expose the designer's private Workspace, Project Journal, Pattern Library source material, Sewing workspace, Time & Motion or private media merely because public product moderation exists.

## 6. MEMBER authentication and realm separation

Perfect Fit authenticates through EIP MEMBER/gateway flows.

- Normal Perfect Fit member/designer: MEMBER realm.
- Perfect Fit site administrator/moderator: MEMBER realm plus explicit Perfect Fit role such as `PF_ADMIN`.
- Perfect Fit admin status does not grant EIP Dashboard/Admin Shell access.
- EIP administrative authentication remains a separate realm and lifecycle.
- Tenant identity is resolved by the gateway/connection context, not trusted from a browser-supplied tenant id.

Perfect Fit must not contain EIP administrative credentials or gain a separate trusted backend merely to authenticate.

## 7. Community and publication

Community Feedback persists through EIP and reuses the kernel `blog_post` service-object model and `ECOM_BLOG_POST_FLOW`; it does not own a duplicate community database table.

Publication and moderation use governed process bindings and fail closed when the required process binding is absent. Curation metadata and publication workflow are separate concerns.

Key frontend repository/domain areas include:

- `src/lib/communityPostsRepository.js`
- publication/review helpers under `src/lib`
- `components/CreationsAndFeedback.jsx`
- moderator/publication components

## 8. Checkout and purchases

Checkout is EIP-governed. Perfect Fit renders available governed methods and sends commerce requests through the public-commerce transport.

Security invariants:

- Perfect Fit does not authorize payment by browser assertion alone.
- Raw card/CVC credentials are not collected by the EIP checkout contract.
- Provider redirects must be HTTPS.
- Purchase completion depends on verified EIP payment lifecycle state.
- The cart clears only after all purchased files have been successfully retrieved.

Current regression contracts:

- `services/api/test/payment_checkout_backend_contract.test.mjs`
- `services/api/test/payment_checkout_frontend_contract.test.mjs`

## 9. EIP asset URLs

EIP may return signed root-relative `/assets/...` URLs. Perfect Fit must resolve EIP-owned signed asset paths against the EIP API origin rather than the Perfect Fit static frontend origin.

The asset resolver belongs at the EIP adapter/boundary and must not duplicate storage or weaken signing.

Regression command:

```text
npm run test:eip-assets --prefix apps/samara-web/my-vite-react-app
```

## 10. Metadata-driven governance

Business meaning owned by EIP should not be duplicated as hardcoded frontend taxonomy.

Examples include:

- governed dropdown values;
- product curation tags and their behavioral attributes;
- process definitions and bindings;
- runtime/schema manifests;
- availability, ordering and surface-target metadata.

Metadata-driven does **not** mean EIP-component-driven. Perfect Fit consumes governed meaning while retaining its richer UI.

## 11. Browser-local data that may remain legitimate

Browser persistence is appropriate for non-authoritative concerns such as:

- compatibility preferences;
- layout/presentation preferences where explicitly intended;
- transient caches/outboxes;
- object URLs and local media hydration;
- recovery/resilience state;
- opt-in development/demo data where explicitly gated.

Do not infer enterprise authority solely because a module reads or writes browser storage.

## 12. Legacy application tree

`apps/samara-web/sartorial-sewing-pattern-atelier` is a historical/legacy tree and is not the active Perfect Fit production package.

Do not copy its old desktop/mobile selector, `MobileAppView` shell, browser-authority assumptions or older workflow implementations back into `my-vite-react-app` without an explicit architectural decision.

The active package is:

```text
apps/samara-web/my-vite-react-app
```

## 13. Regression and build gates

Important checks include:

```text
npm --workspace @eip/core-api run test:security
node services/api/test/perfect_fit_responsive_shell.test.mjs
npm run build --prefix apps/samara-web/my-vite-react-app
npm run test:eip-assets --prefix apps/samara-web/my-vite-react-app
npm run audit:metadata-ui --prefix apps/samara-web/my-vite-react-app
npm run audit:runtime-data --prefix apps/samara-web/my-vite-react-app
```

The GitHub security workflow also validates lockfile integrity, the Dashboard build, Perfect Fit build/asset boundary and high/critical production dependency advisories.

## 14. Non-regression checklist

Before changing Perfect Fit integration code, verify:

1. No new trusted Perfect Fit backend was introduced.
2. MEMBER and EIP Admin realms remain separate.
3. Tenant identity is gateway-resolved.
4. Private designer Workspace data remains private.
5. EIP remains authoritative for governed business meaning and server persistence.
6. Perfect Fit's richer UI and responsive behavior are preserved.
7. The retired dedicated mobile shell remains impossible to select.
8. Browser caches/preferences are not mistaken for authoritative business storage.
9. Process bindings remain fail-closed.
10. No new table/schema/migration is added unless genuinely necessary.
